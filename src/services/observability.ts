/**
 * BharatBridge Real-Time Latency Metrics & Observability Service
 * Tracks STT, Translation, TTS, WebSocket transport, and total pipeline latency.
 * Provides in-memory Minute/Day aggregation and background Cosmos DB metrics persistence.
 */

import crypto from "crypto";
import {
  TelemetryEvent,
  TelemetryStage,
  TelemetryEventType,
  TelemetryStatus,
  FailureCode,
  SystemMetricsSummary,
  MetricPercentiles
} from "../types/telemetry";

export interface LatencyMetricRecord {
  requestId: string;
  sessionId: string;
  speechSegmentStartAt?: number;
  sttFinalAt?: number;
  translationStartedAt?: number;
  translationCompletedAt?: number;
  ttsStartedAt?: number;
  ttsFirstAudioAt?: number;
  websocketSentAt?: number;
  websocketReceivedAt?: number;
  playbackStartedAt?: number;
  providerSelected: {
    translation: string;
    tts: string;
  };
}

export interface LatencySummary {
  sttMs: number;
  translationMs: number;
  ttsMs: number;
  websocketMs: number;
  playbackStartupMs: number;
  totalPipelineMs: number;
  providerSelected: {
    translation: string;
    tts: string;
  };
}

export interface MinuteMetricsBucket {
  minuteKey: string; // e.g. "2026-10-05T12:15"
  timestamp: number;
  eventsCount: number;
  sentencesCount: number;
  degradedCount: number;
  geminiCalls: number;
  ttsTotalChars: number;
  ttsProviderChars: Record<string, number>;
  languages: Record<string, number>;
  providers: Record<string, number>;
  latencies: number[];
}

export interface DayMetricsBucket {
  id: string; // "metrics-YYYY-MM-DD-instanceId"
  day: string; // "YYYY-MM-DD" (UTC day)
  pacificDay?: string; // "YYYY-MM-DD" (US Pacific day for Google API Quota resets at 00:00 PST/PDT)
  type: "daily_aggregate";
  updatedAt: string;
  runStartedAt: string;
  totalEvents: number;
  totalSentences: number;
  degradedEvents: number;
  geminiCalls: number;
  geminiCallsPacificDay: number;
  geminiCalls429Count: number;
  geminiDailyLimit?: number | null;
  ttsTotalChars: number;
  ttsDailyCharLimit?: number | null;
  ttsCharsByProvider: Record<string, number>;
  languageDistribution: Record<string, number>;
  providerDistribution: Record<string, number>;
  activeSessionsCount: number;
  peakConcurrentListeners: number;
  latencyMsP50: number;
  latencyMsP90: number;
  latencyMsP95: number;
  latencyPercentilesSource?: string;
}

/**
 * Combines multiple per-run daily metrics documents for the same calendar day
 * by summing event counters, taking peak listener maximums, and labeling percentiles from latest run.
 */
export function combineDayRunDocuments(docs: DayMetricsBucket[]): DayMetricsBucket | null {
  if (!docs || docs.length === 0) return null;
  const first = docs[0];
  const combined: DayMetricsBucket = {
    id: `combined-${first.day}`,
    day: first.day,
    pacificDay: first.pacificDay,
    type: "daily_aggregate",
    updatedAt: docs.reduce((latest, d) => (d.updatedAt > latest ? d.updatedAt : latest), first.updatedAt),
    runStartedAt: docs.reduce((earliest, d) => (d.runStartedAt < earliest ? d.runStartedAt : earliest), first.runStartedAt),
    totalEvents: 0,
    totalSentences: 0,
    degradedEvents: 0,
    geminiCalls: 0,
    geminiCallsPacificDay: 0,
    geminiCalls429Count: 0,
    geminiDailyLimit: first.geminiDailyLimit,
    ttsTotalChars: 0,
    ttsDailyCharLimit: first.ttsDailyCharLimit,
    ttsCharsByProvider: {},
    languageDistribution: {},
    providerDistribution: {},
    activeSessionsCount: docs[docs.length - 1]?.activeSessionsCount || 0,
    peakConcurrentListeners: 0,
    latencyMsP50: 0,
    latencyMsP90: 0,
    latencyMsP95: 0,
    latencyPercentilesSource: "latest_run"
  };

  for (const doc of docs) {
    combined.totalEvents += doc.totalEvents || 0;
    combined.totalSentences += doc.totalSentences || 0;
    combined.degradedEvents += doc.degradedEvents || 0;
    combined.geminiCalls += doc.geminiCalls || 0;
    combined.geminiCallsPacificDay += doc.geminiCallsPacificDay || 0;
    combined.geminiCalls429Count += doc.geminiCalls429Count || 0;
    combined.ttsTotalChars += doc.ttsTotalChars || 0;
    combined.peakConcurrentListeners = Math.max(combined.peakConcurrentListeners, doc.peakConcurrentListeners || 0);

    for (const [prov, count] of Object.entries(doc.ttsCharsByProvider || {})) {
      combined.ttsCharsByProvider[prov] = (combined.ttsCharsByProvider[prov] || 0) + count;
    }
    for (const [lang, count] of Object.entries(doc.languageDistribution || {})) {
      combined.languageDistribution[lang] = (combined.languageDistribution[lang] || 0) + count;
    }
    for (const [prov, count] of Object.entries(doc.providerDistribution || {})) {
      combined.providerDistribution[prov] = (combined.providerDistribution[prov] || 0) + count;
    }
  }

  const latestRun = docs[docs.length - 1];
  combined.latencyMsP50 = latestRun?.latencyMsP50 || 0;
  combined.latencyMsP90 = latestRun?.latencyMsP90 || 0;
  combined.latencyMsP95 = latestRun?.latencyMsP95 || 0;

  return combined;
}

/**
 * Generate a canonical eventId format: BB-YYYYMMDD-HHMMSS-XXXX
 */
export function generateEventId(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6);
  return `BB-${year}${month}${day}-${hours}${mins}${secs}-${rand}`;
}

let hasLoggedSaltWarning = false;

/**
 * Hashes a sessionId using SHA-256 with a server-side salt (ADMIN_METRICS_SALT)
 * for privacy-preserving metric aggregation.
 * If ADMIN_METRICS_SALT is missing, session IDs are omitted (null) and a warning is logged once.
 */
export function hashSessionId(sessionId: string): string | null {
  if (!sessionId) return null;
  let salt = "";
  try {
    if (typeof process !== "undefined" && process?.env) {
      salt = process.env.ADMIN_METRICS_SALT || "";
    } else if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      salt = (import.meta as any).env.VITE_ADMIN_METRICS_SALT || "";
    }
  } catch (_) {}

  if (!salt) {
    if (!hasLoggedSaltWarning) {
      console.warn("[ADMIN_METRICS] ADMIN_METRICS_SALT is missing in environment. Disabling session-id hashing in metrics (no session IDs recorded).");
      hasLoggedSaltWarning = true;
    }
    return null;
  }
  try {
    if (typeof crypto !== "undefined" && (crypto as any).createHash) {
      return (crypto as any).createHash("sha256").update(`${sessionId}:${salt}`).digest("hex").substring(0, 16);
    }
  } catch (_) {}
  return null;
}

export class ObservabilityService {
  private instanceId = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  private activeMetrics: Map<string, LatencyMetricRecord> = new Map();
  private eventsRingBuffer: TelemetryEvent[] = [];
  private readonly maxBufferSize = 100;
  private sequenceCounter = 0;

  // Bounded Operational Counters
  private activePanelistsCount = 0;
  private activeListenersCount = 0;
  private activeLanguagesSet: Set<string> = new Set();
  private activeSessionsSet: Set<string> = new Set();
  private successTotal = 0;
  private failureTotal = 0;
  private reconnectTotal = 0;
  private providerFailuresMap: Record<string, number> = {};

  // Sliding latency samples for percentile estimation
  private latencySamples: {
    stt: number[];
    translation: number[];
    websocket: number[];
    tts: number[];
    total: number[];
  } = {
    stt: [],
    translation: [],
    websocket: [],
    tts: [],
    total: []
  };

  // Phase 1 Aggregation Buckets
  private minuteBuckets: Map<string, MinuteMetricsBucket> = new Map();
  private dayBuckets: Map<string, DayMetricsBucket> = new Map();
  private peakConcurrentListenersToday = 0;
  private activeSessionsCountToday = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushTimerRunning = false;

  public recordEvent(params: {
    eventId: string;
    sessionId: string;
    speakerId?: string;
    listenerId?: string;
    sourceLanguage: string;
    targetLanguage?: string;
    stage: TelemetryStage;
    eventType: TelemetryEventType;
    status: TelemetryStatus;
    provider?: string;
    latencyMs?: number | 'NOT_MEASURED';
    errorCode?: FailureCode | string;
    errorMessage?: string;
    degraded?: boolean;
    charCount?: number;
  }): TelemetryEvent {
    this.sequenceCounter++;
    const hashedSessionId = hashSessionId(params.sessionId);
    const event: TelemetryEvent = {
      ...params,
      sessionId: hashedSessionId || "omitted",
      timestamp: Date.now(),
      sequenceNumber: this.sequenceCounter
    };

    // Maintain bounded ring buffer
    this.eventsRingBuffer.push(event);
    if (this.eventsRingBuffer.length > this.maxBufferSize) {
      this.eventsRingBuffer.shift();
    }

    // Update counters
    if (params.status === 'SUCCESS') this.successTotal++;
    if (params.status === 'FAILURE' || params.status === 'REJECTED') {
      this.failureTotal++;
      if (params.provider) {
        this.providerFailuresMap[params.provider] = (this.providerFailuresMap[params.provider] || 0) + 1;
      }
    }

    // Collect latency samples if valid number
    if (typeof params.latencyMs === 'number' && params.latencyMs >= 0) {
      if (params.stage === 'STT') this.addSample(this.latencySamples.stt, params.latencyMs);
      if (params.stage === 'TRANSLATION') this.addSample(this.latencySamples.translation, params.latencyMs);
      if (params.stage === 'WEBSOCKET') this.addSample(this.latencySamples.websocket, params.latencyMs);
      if (params.stage === 'TTS') this.addSample(this.latencySamples.tts, params.latencyMs);
      if (params.stage === 'AUDIO') this.addSample(this.latencySamples.total, params.latencyMs);
    }

    // Fire-and-forget in-memory aggregation update (never blocking delivery path)
    try {
      this.aggregateEventToBuckets({
        sessionId: params.sessionId,
        stage: params.stage,
        targetLanguage: params.targetLanguage,
        provider: params.provider,
        degraded: Boolean(params.degraded || (params.provider && params.provider.includes("fallback"))),
        latencyMs: typeof params.latencyMs === "number" ? params.latencyMs : undefined,
        charCount: params.charCount,
        errorCode: params.errorCode
      });
    } catch (aggErr) {
      console.warn("[OBSERVABILITY][AGGREGATION_WARNING]", aggErr);
    }

    // Structured JSON log output for debugging
    console.log(`[BHARATBRIDGE][TELEMETRY] ${JSON.stringify(event)}`);
    return event;
  }

  private aggregateEventToBuckets(params: {
    sessionId: string;
    stage: TelemetryStage;
    targetLanguage?: string;
    provider?: string;
    degraded?: boolean;
    latencyMs?: number;
    charCount?: number;
    errorCode?: string;
  }): void {
    const now = new Date();
    const isoStr = now.toISOString();
    const dayKey = isoStr.split("T")[0];
    const minuteKey = isoStr.substring(0, 16);

    // Compute US Pacific Day Key (Google Gemini API Quota resets at 00:00 Pacific Time)
    const pacificDayKey = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" })
      .format(now)
      .split("/")
      .reverse()
      .join("-");

    const isGeminiProvider = params.provider === "gemini-3.8-flash" || params.provider?.includes("gemini");
    const is429Error = params.errorCode === "429_RATE_LIMIT" || params.errorCode === "429";

    // 1. Minute Bucket Update
    let minBucket = this.minuteBuckets.get(minuteKey);
    if (!minBucket) {
      minBucket = {
        minuteKey,
        timestamp: Date.now(),
        eventsCount: 0,
        sentencesCount: 0,
        degradedCount: 0,
        geminiCalls: 0,
        ttsTotalChars: 0,
        ttsProviderChars: {},
        languages: {},
        providers: {},
        latencies: []
      };
      this.minuteBuckets.set(minuteKey, minBucket);
      if (this.minuteBuckets.size > 120) {
        const oldestKey = this.minuteBuckets.keys().next().value;
        if (oldestKey) this.minuteBuckets.delete(oldestKey);
      }
    }

    minBucket.eventsCount++;
    if (params.stage === "TRANSLATION") {
      minBucket.sentencesCount++;
    }
    if (isGeminiProvider && !is429Error) {
      minBucket.geminiCalls++;
    }
    if (params.degraded) {
      minBucket.degradedCount++;
    }
    if (params.targetLanguage) {
      minBucket.languages[params.targetLanguage] = (minBucket.languages[params.targetLanguage] || 0) + 1;
    }
    if (params.provider) {
      minBucket.providers[params.provider] = (minBucket.providers[params.provider] || 0) + 1;
    }
    if (params.stage === "TTS" && params.charCount) {
      minBucket.ttsTotalChars += params.charCount;
      const provKey = params.provider || "unknown";
      minBucket.ttsProviderChars[provKey] = (minBucket.ttsProviderChars[provKey] || 0) + params.charCount;
    }
    if (typeof params.latencyMs === "number" && params.latencyMs >= 0) {
      minBucket.latencies.push(params.latencyMs);
      if (minBucket.latencies.length > 200) minBucket.latencies.shift();
    }

    // 2. Day Bucket Update (Per-run document ID to prevent overwrite across server restarts)
    const dayDocId = `metrics-${dayKey}-${this.instanceId}`;
    let dayBucket = this.dayBuckets.get(dayKey);
    if (!dayBucket) {
      dayBucket = {
        id: dayDocId,
        day: dayKey,
        pacificDay: pacificDayKey,
        type: "daily_aggregate",
        updatedAt: isoStr,
        runStartedAt: new Date(Number(this.instanceId.split("-")[0])).toISOString(),
        totalEvents: 0,
        totalSentences: 0,
        degradedEvents: 0,
        geminiCalls: 0,
        geminiCallsPacificDay: 0,
        geminiCalls429Count: 0,
        geminiDailyLimit: process.env.GEMINI_DAILY_LIMIT ? Number(process.env.GEMINI_DAILY_LIMIT) : null,
        ttsTotalChars: 0,
        ttsDailyCharLimit: process.env.TTS_DAILY_CHAR_LIMIT ? Number(process.env.TTS_DAILY_CHAR_LIMIT) : null,
        ttsCharsByProvider: {},
        languageDistribution: {},
        providerDistribution: {},
        activeSessionsCount: this.activeSessionsCountToday,
        peakConcurrentListeners: this.peakConcurrentListenersToday,
        latencyMsP50: 0,
        latencyMsP90: 0,
        latencyMsP95: 0
      };
      this.dayBuckets.set(dayKey, dayBucket);
      if (this.dayBuckets.size > 30) {
        const oldestDayKey = this.dayBuckets.keys().next().value;
        if (oldestDayKey) this.dayBuckets.delete(oldestDayKey);
      }
    }

    dayBucket.updatedAt = isoStr;
    dayBucket.totalEvents++;
    if (params.stage === "TRANSLATION") {
      dayBucket.totalSentences++;
    }
    if (isGeminiProvider && !is429Error) {
      dayBucket.geminiCalls++;
      dayBucket.geminiCallsPacificDay++;
    }
    if (is429Error) {
      dayBucket.geminiCalls429Count++;
    }
    if (params.degraded) {
      dayBucket.degradedEvents++;
    }
    if (params.targetLanguage) {
      dayBucket.languageDistribution[params.targetLanguage] = (dayBucket.languageDistribution[params.targetLanguage] || 0) + 1;
    }
    if (params.provider) {
      dayBucket.providerDistribution[params.provider] = (dayBucket.providerDistribution[params.provider] || 0) + 1;
    }
    if (params.stage === "TTS" && params.charCount) {
      dayBucket.ttsTotalChars += params.charCount;
      const provKey = params.provider || "unknown";
      dayBucket.ttsCharsByProvider[provKey] = (dayBucket.ttsCharsByProvider[provKey] || 0) + params.charCount;
    }

    const p = this.calcPercentiles(this.latencySamples.total.length ? this.latencySamples.total : (this.latencySamples.translation.length ? this.latencySamples.translation : [0]));
    dayBucket.latencyMsP50 = p.p50;
    dayBucket.latencyMsP90 = p.p90;
    dayBucket.latencyMsP95 = p.p95;
    dayBucket.activeSessionsCount = this.activeSessionsCountToday;
    dayBucket.peakConcurrentListeners = Math.max(dayBucket.peakConcurrentListeners, this.peakConcurrentListenersToday);
  }

  public recordSessionStart(sessionId: string): void {
    if (sessionId) {
      this.activeSessionsSet.add(sessionId);
      this.updateSessionAndListenerMetrics(this.activeSessionsSet.size, this.activeListenersCount);
    }
  }

  public recordSessionEnd(sessionId: string): void {
    if (sessionId) {
      this.activeSessionsSet.delete(sessionId);
      this.updateSessionAndListenerMetrics(this.activeSessionsSet.size, this.activeListenersCount);
    }
  }

  public updatePeakListeners(listeners: number): void {
    this.updateSessionAndListenerMetrics(this.activeSessionsSet.size, listeners);
  }

  public updateSessionAndListenerMetrics(activeSessions: number, listeners: number): void {
    this.activeSessionsCountToday = activeSessions;
    if (listeners > this.peakConcurrentListenersToday) {
      this.peakConcurrentListenersToday = listeners;
    }
    const todayKey = new Date().toISOString().split("T")[0];
    const dayBucket = this.dayBuckets.get(todayKey);
    if (dayBucket) {
      dayBucket.activeSessionsCount = activeSessions;
      dayBucket.peakConcurrentListeners = Math.max(dayBucket.peakConcurrentListeners, listeners);
    }
  }

  public async flushMetricsToCosmos(): Promise<void> {
    try {
      const todayKey = new Date().toISOString().split("T")[0];
      const dayDoc = this.dayBuckets.get(todayKey);
      if (!dayDoc) return;

      const { getContainer } = await import("../lib/cosmos-client");
      const container = await getContainer("metrics");
      if (!container) return;

      dayDoc.updatedAt = new Date().toISOString();
      await container.items.upsert(dayDoc);
      console.log(`[METRICS_FLUSH] Successfully flushed per-run daily metrics document '${dayDoc.id}' to Cosmos DB container 'metrics'.`);
    } catch (err: any) {
      console.warn(`[METRICS_FLUSH] Warning: Cosmos DB metrics flush encountered error (non-fatal):`, err?.message || err);
    }
  }

  public startCosmosFlushTimer(intervalMs = 60000): void {
    if (this.isFlushTimerRunning) return;
    this.isFlushTimerRunning = true;
    this.flushTimer = setInterval(() => {
      this.flushMetricsToCosmos().catch(() => {});
    }, intervalMs);
  }

  public getMinuteBuckets(): Map<string, MinuteMetricsBucket> {
    return this.minuteBuckets;
  }

  public getDayBuckets(): Map<string, DayMetricsBucket> {
    return this.dayBuckets;
  }

  private addSample(arr: number[], value: number) {
    arr.push(value);
    if (arr.length > 50) arr.shift();
  }

  private calcPercentiles(samples: number[]): MetricPercentiles {
    if (samples.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0 };
    const sorted = [...samples].sort((a, b) => a - b);
    const getP = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    return {
      p50: getP(0.50),
      p90: getP(0.90),
      p95: getP(0.95),
      p99: getP(0.99)
    };
  }

  public updateSystemCounts(panelists: number, listeners: number, languages: string[]) {
    this.activePanelistsCount = panelists;
    this.activeListenersCount = listeners;
    this.activeLanguagesSet = new Set(languages);
    this.updateSessionAndListenerMetrics(this.activeSessionsCountToday, listeners);
  }

  public getSystemMetricsSummary(): SystemMetricsSummary {
    return {
      activePanelists: this.activePanelistsCount,
      activeListeners: this.activeListenersCount,
      activeLanguages: this.activeLanguagesSet.size,
      successCount: this.successTotal,
      failureCount: this.failureTotal,
      reconnectCount: this.reconnectTotal,
      providerFailures: { ...this.providerFailuresMap },
      latencies: {
        stt: this.calcPercentiles(this.latencySamples.stt),
        translation: this.calcPercentiles(this.latencySamples.translation),
        websocket: this.calcPercentiles(this.latencySamples.websocket),
        tts: this.calcPercentiles(this.latencySamples.tts),
        totalPipeline: this.calcPercentiles(this.latencySamples.total)
      }
    };
  }

  public startMetric(requestId: string, sessionId: string): LatencyMetricRecord {
    const record: LatencyMetricRecord = {
      requestId,
      sessionId,
      speechSegmentStartAt: Date.now(),
      providerSelected: {
        translation: "pending",
        tts: "pending"
      }
    };
    this.activeMetrics.set(requestId, record);
    return record;
  }

  public recordTimestamp(
    requestId: string,
    field: keyof Omit<LatencyMetricRecord, "requestId" | "sessionId" | "providerSelected">,
    timestamp = Date.now()
  ): void {
    const record = this.activeMetrics.get(requestId);
    if (record) {
      record[field] = timestamp;
    }
  }

  public setProvider(requestId: string, type: "translation" | "tts", providerName: string): void {
    const record = this.activeMetrics.get(requestId);
    if (record) {
      record.providerSelected[type] = providerName;
    }
  }

  public calculateSummary(requestId: string): LatencySummary | null {
    const record = this.activeMetrics.get(requestId);
    if (!record) return null;

    const start = record.speechSegmentStartAt || Date.now();
    const sttEnd = record.sttFinalAt || start;
    const transStart = record.translationStartedAt || sttEnd;
    const transEnd = record.translationCompletedAt || transStart;
    const ttsStart = record.ttsStartedAt || transEnd;
    const ttsEnd = record.ttsFirstAudioAt || ttsStart;
    const wsSent = record.websocketSentAt || ttsEnd;
    const wsRecv = record.websocketReceivedAt || wsSent;
    const playbackStart = record.playbackStartedAt || wsRecv;

    const summary: LatencySummary = {
      sttMs: Math.max(0, sttEnd - start),
      translationMs: Math.max(0, transEnd - transStart),
      ttsMs: Math.max(0, ttsEnd - ttsStart),
      websocketMs: Math.max(0, wsRecv - wsSent),
      playbackStartupMs: Math.max(0, playbackStart - wsRecv),
      totalPipelineMs: Math.max(0, playbackStart - start),
      providerSelected: record.providerSelected
    };

    this.activeMetrics.delete(requestId);
    return summary;
  }

  public logLatencyReport(summary: LatencySummary): void {
    console.log(`
┌─────────────────────────────────────────────────────────┐
│ BHARATBRIDGE REAL-TIME LATENCY BENCHMARK REPORT         │
├─────────────────────────────────────────────────────────┤
│ STT Endpointing Latency : ${summary.sttMs.toString().padStart(6)} ms               │
│ Translation Latency    : ${summary.translationMs.toString().padStart(6)} ms (${summary.providerSelected.translation})
│ TTS Synthesis Latency   : ${summary.ttsMs.toString().padStart(6)} ms (${summary.providerSelected.tts})
│ WebSocket Transport    : ${summary.websocketMs.toString().padStart(6)} ms               │
│ Playback Startup       : ${summary.playbackStartupMs.toString().padStart(6)} ms               │
├─────────────────────────────────────────────────────────┤
│ TOTAL PIPELINE LATENCY  : ${summary.totalPipelineMs.toString().padStart(6)} ms               │
└─────────────────────────────────────────────────────────┘
    `);
  }
}

export const observabilityService = new ObservabilityService();
