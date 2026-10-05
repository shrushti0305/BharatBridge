/**
 * BharatBridge Real-Time Latency Metrics & Observability Service
 * Tracks STT, Translation, TTS, WebSocket transport, and total pipeline latency.
 */

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

export class ObservabilityService {
  private activeMetrics: Map<string, LatencyMetricRecord> = new Map();
  private eventsRingBuffer: TelemetryEvent[] = [];
  private readonly maxBufferSize = 100;
  private sequenceCounter = 0;

  // Bounded Operational Counters
  private activePanelistsCount = 0;
  private activeListenersCount = 0;
  private activeLanguagesSet: Set<string> = new Set();
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
  }): TelemetryEvent {
    this.sequenceCounter++;
    const event: TelemetryEvent = {
      ...params,
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

    // Structured JSON log output for debugging
    console.log(`[BHARATBRIDGE][TELEMETRY] ${JSON.stringify(event)}`);
    return event;
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
