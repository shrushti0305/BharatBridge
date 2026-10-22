import crypto from "crypto";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import dns from "dns";
import { observabilityService, generateEventId, setCosmosMetricsContainerGetter } from "./src/services/observability";
import { getCanonicalLanguageCode } from "./src/registry/languages.js";
import { getAdminAuth } from "./src/lib/firebase-admin";
import {
  initCosmosDB,
  cosmosHealthState,
  getCosmosClient,
  getContainer,
  upsertFinalizedThoughtDocument,
  upsertSessionDocument,
  loadSessionFromCosmos
} from "./src/lib/cosmos-client.js";

// Hook up server-side metrics container flusher
setCosmosMetricsContainerGetter(async () => getContainer("metrics"));

// Production guard against fake Cosmos DB
if (process.env.COSMOS_USE_FAKE === "true" && process.env.NODE_ENV === "production") {
  console.error("[FATAL][SECURITY] COSMOS_USE_FAKE is strictly forbidden in production mode (NODE_ENV=production). Refusing to boot.");
  process.exit(1);
}

// Process exception safety
process.on("uncaughtException", (err) => {
  console.error("[FATAL][UNCAUGHT_EXCEPTION]", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.warn("[WARN][UNHANDLED_REJECTION]", reason);
});

// Prevent Windows IPv6 DNS connection timeouts on Node fetch
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

export function escapeXml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function stripMaskedProfanity(text: string): string {
  if (!text) return "";
  return text.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
}

export function cleanIndianText(text: string): string {
  if (!text) return "";
  let cleaned = stripMaskedProfanity(text.normalize("NFC"));
  // Remove space immediately following Devanagari Virama (U+094D) or Gujarati Virama (U+0ACD)
  cleaned = cleaned.replace(/([\u094D\u0ACD])\s+/g, "$1");
  // Normalize redundant whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

export function timingSafeEqualToken(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const hashProvided = crypto.createHash("sha256").update(provided).digest();
  const hashExpected = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(hashProvided, hashExpected);
}

export function applyGenderAgreementFallback(text: string, targetLang: string, gender?: string): string {
  if (!text || gender !== "female") return text;
  const cleanLang = (targetLang || "").split("-")[0].toLowerCase();
  if (cleanLang === "hi") {
    return text
      .replace(/रहा\s+(हूँ|हू|हूं)/g, "रही $1")
      .replace(/रहा\s+था/g, "रही थी")
      .replace(/करूंगा/g, "करूंगी")
      .replace(/जाऊंगा/g, "जाऊंगी")
      .replace(/सकता\s+(हूँ|हू|हूं)/g, "सकती $1");
  }
  if (cleanLang === "gu") {
    return text
      .replace(/રહ્યો\s+છું/g, "રહી છું")
      .replace(/રહ્યો\s+હતો/g, "રહી હતી");
  }
  return text;
}

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const LANGUAGE_NAME_MAP: Record<string, string> = {
  en: "English", hi: "Hindi", bn: "Bengali", te: "Telugu", mr: "Marathi",
  ta: "Tamil", ur: "Urdu", gu: "Gujarati", kn: "Kannada", ml: "Malayalam",
  or: "Odia", pa: "Punjabi", as: "Assamese", ma: "Maithili", me: "Meitei",
  sa: "Sanskrit", ks: "Kashmiri", sd: "Sindhi", doi: "Dogri", kok: "Konkani"
};

export interface TtsCacheResult {
  audio: string;
  format?: string;
  byteSize?: number;
  contentType?: string;
  outputFormat?: string;
  provider: string;
  truncated?: boolean;
}

interface TtsCacheEntry {
  value: TtsCacheResult;
  byteSize: number;
  expiresAt: number;
}

export class TtsAudioCache {
  private cache = new Map<string, TtsCacheEntry>();
  private inFlight = new Map<string, Promise<TtsCacheResult>>();
  private maxEntries: number;
  private maxBytes: number;
  private ttlMs: number;
  private currentBytes = 0;

  constructor(options?: { maxEntries?: number; maxBytes?: number; ttlMs?: number }) {
    this.maxEntries = options?.maxEntries ?? 500;
    this.maxBytes = options?.maxBytes ?? (50 * 1024 * 1024); // 50MB
    this.ttlMs = options?.ttlMs ?? (10 * 60 * 1000); // 10 minutes
  }

  public getCacheKey(text: string, languageCode: string, voiceName?: string, gender?: string): string {
    const cleanText = text.trim();
    const cleanLang = (languageCode || "hi").split("-")[0].toLowerCase();
    const cleanVoice = (voiceName || gender || "default").toLowerCase();
    const hash = crypto.createHash("sha256").update(cleanText).digest("hex").slice(0, 16);
    return `${cleanLang}:${cleanVoice}:${hash}`;
  }

  public get(key: string): TtsCacheResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.currentBytes -= entry.byteSize;
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order: delete and set at the end
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  public set(key: string, value: TtsCacheResult): void {
    if (!value || !value.audio) return;

    const estimatedBytes = Buffer.byteLength(value.audio, "utf8") + 256;
    if (estimatedBytes > this.maxBytes) {
      return;
    }

    const existing = this.cache.get(key);
    if (existing) {
      this.currentBytes -= existing.byteSize;
      this.cache.delete(key);
    }

    while (
      (this.cache.size >= this.maxEntries || (this.currentBytes + estimatedBytes > this.maxBytes)) &&
      this.cache.size > 0
    ) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      const oldestEntry = this.cache.get(oldestKey);
      if (oldestEntry) {
        this.currentBytes -= oldestEntry.byteSize;
      }
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      byteSize: estimatedBytes,
      expiresAt: Date.now() + this.ttlMs
    });
    this.currentBytes += estimatedBytes;
  }

  public async getOrSynthesize(key: string, synthesizeFn: () => Promise<TtsCacheResult>): Promise<TtsCacheResult> {
    const cached = this.get(key);
    if (cached) {
      return cached;
    }

    if (this.inFlight.has(key)) {
      return await this.inFlight.get(key)!;
    }

    const inFlightPromise = (async () => {
      try {
        const result = await synthesizeFn();
        if (result && result.audio) {
          this.set(key, result);
        }
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, inFlightPromise);
    return await inFlightPromise;
  }

  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
    this.currentBytes = 0;
  }

  public getStats(): { size: number; currentBytes: number; inFlightCount: number } {
    return {
      size: this.cache.size,
      currentBytes: this.currentBytes,
      inFlightCount: this.inFlight.size
    };
  }
}

export const ttsAudioCache = new TtsAudioCache();

// In-Memory Dual-Layer Rate Limiter Middleware (Keyed per IP AND per Session ID)
export function createRateLimiter(maxRequestsPerIp: number, maxRequestsPerSession: number, windowMs: number) {
  const rateLimitMapByIp = new Map<string, { count: number; resetTime: number }>();
  const rateLimitMapBySession = new Map<string, { count: number; resetTime: number }>();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path === "/health") return next();

    const trustHops = process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || 1 : 1;
    const xff = req.headers["x-forwarded-for"];
    let ip = (req.socket.remoteAddress || "global").toString().trim();
    if (xff && typeof xff === "string") {
      const parts = xff.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        const idx = Math.max(0, parts.length - trustHops);
        ip = parts[idx];
      }
    }
    const token = (
      req.headers["x-session-token"] ||
      req.headers["x-host-token"] ||
      req.body?.token ||
      req.body?.sessionToken ||
      req.body?.hostToken
    )?.toString().trim();

    const sessionId = (req.body?.sessionId || req.query?.sessionId || req.headers["x-session-id"] || "global_session").toString().trim();
    const clientKey = token && sessionId !== "global_session" ? `${sessionId}:${token}` : ip;

    const now = Date.now();

    // 1. Client-level Rate Limit Check
    let clientRecord = rateLimitMapByIp.get(clientKey);
    if (!clientRecord || now > clientRecord.resetTime) {
      clientRecord = { count: 1, resetTime: now + windowMs };
      rateLimitMapByIp.set(clientKey, clientRecord);
    } else {
      clientRecord.count++;
    }

    if (clientRecord.count > maxRequestsPerIp) {
      res.setHeader("Retry-After", Math.ceil((clientRecord.resetTime - now) / 1000));
      return res.status(429).json({ error: "Too many requests. Please try again later.", status: 429 });
    }

    // 2. Session-level Rate Limit Check (Skipped for individual token holders)
    if (sessionId && sessionId !== "global_session" && !token) {
      let sessionRecord = rateLimitMapBySession.get(sessionId);
      if (!sessionRecord || now > sessionRecord.resetTime) {
        sessionRecord = { count: 1, resetTime: now + windowMs };
        rateLimitMapBySession.set(sessionId, sessionRecord);
      } else {
        sessionRecord.count++;
      }

      if (sessionRecord.count > maxRequestsPerSession) {
        res.setHeader("Retry-After", Math.ceil((sessionRecord.resetTime - now) / 1000));
        return res.status(429).json({ error: "Too many requests for this session. Please try again later.", status: 429 });
      }
    }

    next();
  };
}

async function startServer() {
  const app = express();
  app.set("trust proxy", process.env.TRUST_PROXY ? (Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY) : 1);
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  app.use(express.json({ limit: "10mb" }));
  app.use((_req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  });
  app.use("/api/", createRateLimiter(60, 30, 60 * 1000));

  if (!process.env.ADMIN_TOKEN || !process.env.ADMIN_TOKEN.trim()) {
    console.warn("[SECURITY][CONFIG_WARNING] ADMIN_TOKEN is unset or empty. All admin routes will deny access.");
  }

  const SERVER_STARTED_AT = new Date().toISOString();
  observabilityService.startCosmosFlushTimer(60000);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: process.env.NODE_ENV || 'development',
      startedAt: SERVER_STARTED_AT,
      azureStorageConfigured: Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING),
      cosmos: {
        configured: cosmosHealthState.configured,
        reachable: cosmosHealthState.reachable,
        lastWriteOk: cosmosHealthState.lastWriteOk,
        lastError: cosmosHealthState.lastError
      }
    });
  });

  // Room management types & session registry
  type LanguageGroup = {
    geminiSession: any | null;
    listeners: Set<WebSocket>;
    isInitializing?: boolean;
  };

  type SessionMessage = {
    originalText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    timestamp: number;
    eventId?: string;
    speakerId?: string;
    speakerName?: string;
    provider?: string;
    degraded?: boolean;
    translations?: Record<string, string>;
  };

  type PanelistItem = {
    speakerId: string;
    userId: string;
    userName: string;
    gender?: string;
    ws: WebSocket;
  };

  type PendingRequestItem = {
    userId: string;
    userName: string;
    ws: WebSocket;
    requestedAt: number;
    targetLang?: string;
  };

  type SessionState = {
    speaker: WebSocket | null;
    organizerWs: WebSocket | null;
    organizerId: string | null;
    hostToken?: string | null;
    hostTokenHash?: string | null;
    sessionToken?: string | null;
    sessionTokens?: Map<string, number>;
    ended?: boolean;
    panelists: Map<string, PanelistItem>;
    pendingRequests: Map<string, PendingRequestItem>;
    languageGroups: Map<string, LanguageGroup>;
    speakerGender: string;
    topic?: string;
    isDuoMode?: boolean;
    messages: SessionMessage[];
    lastActivity: number;
  };

  const sessions = new Map<string, SessionState>();

  function verifyHostToken(req: express.Request, session: any): boolean {
    if (!session || session.ended) return false;
    const clientToken = (
      req.headers["x-host-token"] ||
      req.headers["x-session-token"] ||
      (req.query?.hostToken as string) ||
      (req.query?.sessionToken as string) ||
      req.body?.hostToken ||
      req.body?.token
    )?.toString().trim();

    if (!clientToken) return false;
    if (session.hostToken && timingSafeEqualToken(clientToken, session.hostToken)) return true;
    if (session.hostTokenHash) {
      const hash = crypto.createHash("sha256").update(clientToken).digest("hex");
      if (timingSafeEqualToken(hash, session.hostTokenHash)) return true;
    }
    return false;
  }

  function verifySessionToken(req: express.Request, session: any): { valid: boolean; expired?: boolean } {
    if (!session || session.ended) return { valid: false };
    const clientToken = (
      req.headers["x-session-token"] ||
      req.headers["x-host-token"] ||
      (req.query?.sessionToken as string) ||
      (req.query?.hostToken as string) ||
      req.body?.sessionToken ||
      req.body?.token ||
      req.body?.hostToken
    )?.toString().trim();

    if (!clientToken) return { valid: false };
    const now = Date.now();
    let tokenExpired = false;

    if (session.sessionTokens && session.sessionTokens instanceof Map) {
      for (const [tok, exp] of session.sessionTokens.entries()) {
        if (timingSafeEqualToken(clientToken, tok)) {
          if (exp > now) return { valid: true };
          tokenExpired = true;
        }
      }
    }

    if (session.hostToken && timingSafeEqualToken(clientToken, session.hostToken)) return { valid: true };
    if (session.hostTokenHash) {
      const hash = crypto.createHash("sha256").update(clientToken).digest("hex");
      if (timingSafeEqualToken(hash, session.hostTokenHash)) return { valid: true };
    }

    if (tokenExpired) {
      return { valid: false, expired: true };
    }
    return { valid: false };
  }

  // Azure Blob Storage Upload for Captions (Dual-Format JSON + CSV)
  app.post("/api/azure/upload-caption", async (req, res) => {
    const { sessionId, sessionName, captions } = req.body || {};
    const activeSessionId = (sessionId || req.headers["x-session-id"] || "").toString().trim();
    if (!activeSessionId || !sessions.has(activeSessionId)) {
      return res.status(403).json({ error: "Forbidden: Valid active session and hostToken are required", code: "HOST_TOKEN_REQUIRED" });
    }
    const sessionObj = sessions.get(activeSessionId);
    if (!verifyHostToken(req, sessionObj)) {
      return res.status(403).json({ error: "Forbidden: HostToken required for caption upload", code: "HOST_TOKEN_REQUIRED" });
    }

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "ai-audio";
    const timeStamp = Date.now();
    const csvBlobName = `captions-${activeSessionId}-${timeStamp}.csv`;

    if (!connectionString) {
      return res.status(200).json({
        success: true,
        mock: true,
        message: "Azure Storage keys not set in .env. Captions logged locally.",
        blobName: csvBlobName,
        blobUrl: `local://storage/${csvBlobName}`
      });
    }

    try {
      const { BlobServiceClient } = await import("@azure/storage-blob" as any);
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();

      const jsonBlobName = `captions-${activeSessionId}-${timeStamp}.json`;
      const jsonBlockBlobClient = containerClient.getBlockBlobClient(jsonBlobName);
      const jsonContent = JSON.stringify({ sessionId: activeSessionId, sessionName, createdAt: new Date().toISOString(), captions }, null, 2);

      await jsonBlockBlobClient.upload(jsonContent, jsonContent.length, {
        blobHTTPHeaders: { blobContentType: "application/json" }
      });

      // Upload CSV blob for zero-JSON analytics & spreadsheet inspection
      const csvHeader = "Timestamp,Original Language,Original Text,Target Language,Translated Text\n";
      const csvRows = (captions || []).map((c: any) => 
        `"${c.timestamp || ''}","${c.originalLanguage || ''}","${(c.originalCaption || c.originalText || '').replace(/"/g, '""')}","${c.translatedLanguage || ''}","${(c.translatedCaption || c.translatedText || '').replace(/"/g, '""')}"`
      ).join("\n");
      const csvContent = "\uFEFF" + csvHeader + csvRows;

      const csvBlobName = `captions-${sessionId}-${timeStamp}.csv`;
      const csvBlockBlobClient = containerClient.getBlockBlobClient(csvBlobName);
      await csvBlockBlobClient.upload(csvContent, Buffer.byteLength(csvContent), {
        blobHTTPHeaders: { blobContentType: "text/csv; charset=utf-8" }
      });

      res.json({
        success: true,
        blobName: csvBlobName,
        blobUrl: csvBlockBlobClient.url,
        jsonBlobUrl: jsonBlockBlobClient.url
      });
    } catch (error: any) {
      console.error("Azure Storage Upload Error:", error);
      res.status(500).json({ error: error.message || "Failed to upload to Azure Storage" });
    }
  });

  // AI Session Summary Endpoint using Gemini AI + Cloud/Local Storage Persistence
  app.post("/api/session-summary", async (req, res) => {
    const { sessionId, messages, targetLanguage } = req.body || {};
    const activeSessionId = (sessionId || req.headers["x-session-id"] || "").toString().trim();
    if (!activeSessionId || !sessions.has(activeSessionId)) {
      return res.status(403).json({ error: "Forbidden: Valid active session and hostToken are required", code: "HOST_TOKEN_REQUIRED" });
    }
    const sessionObj = sessions.get(activeSessionId);
    if (!verifyHostToken(req, sessionObj)) {
      return res.status(403).json({ error: "Forbidden: HostToken required for session summary", code: "HOST_TOKEN_REQUIRED" });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No transcript messages provided for summary." });
    }

    try {
      const transcriptText = messages.map((m: any, idx: number) => {
        const orig = m.originalText || m.text || "";
        const trans = m.translatedText || "";
        return `[${idx + 1}] Original: "${orig}" | Translated (${targetLanguage || 'Target'}): "${trans}"`;
      }).join("\n");

      const prompt = `You are the AI Summarizer for BharatBridge, a real-time multilingual platform for Indian languages.
Below is the full transcript of a live event session (ID: ${sessionId || 'Event'}).

Transcript:
${transcriptText}

Task:
Please generate a clear, professional, structured AI Summary of this session in ${targetLanguage || 'English'}.
Structure the response as follows:
1. EXECUTIVE SUMMARY: A brief 2-3 sentence overview of what was discussed.
2. KEY HIGHLIGHTS & TAKEAWAYS: 3-5 bullet points summarizing main topics.
3. CHRONOLOGICAL RECAP: Brief line-by-line summary of key statements.

Keep the formatting clean with standard Markdown headers and bullet points.`;

      let summaryText = "";
      if (process.env.GEMINI_API_KEY) {
        try {
          const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL_SUMMARY || "gemini-3.8-flash",
            contents: prompt,
          });
          summaryText = response.text || "";
        } catch (geminiErr: any) {
          console.warn("Gemini AI API generateContent error, falling back to structured summary:", geminiErr);
        }
      }

      // Fallback structured summary generator if Gemini API key is not set or returns empty
      if (!summaryText) {
        summaryText = `### 📊 AI Session Summary (Session #${sessionId || 'Event'})\n\n` +
          `**Total Messages Exchanged:** ${messages.length}\n` +
          `**Target Language:** ${targetLanguage || 'English'}\n\n` +
          `#### Key Highlights:\n` +
          messages.slice(-5).map((m: any) => `- ${m.translatedText || m.originalText}`).join("\n");
      }

      // Automatically store/upload summary to Azure Blob Storage (if configured) or log locally
      let blobName = null;
      let blobUrl = null;
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "ai-audio";

      if (connectionString) {
        try {
          const { BlobServiceClient } = await import("@azure/storage-blob" as any);
          const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
          const containerClient = blobServiceClient.getContainerClient(containerName);
          await containerClient.createIfNotExists();

          blobName = `summary-${sessionId || 'session'}-${Date.now()}.txt`;
          const blockBlobClient = containerClient.getBlockBlobClient(blobName);
          await blockBlobClient.upload(summaryText, Buffer.byteLength(summaryText), {
            blobHTTPHeaders: { blobContentType: "text/plain; charset=utf-8" }
          });
          blobUrl = blockBlobClient.url;
        } catch (azureErr) {
          console.warn("Summary Azure Blob upload fallback:", azureErr);
        }
      }

      res.json({
        success: true,
        summary: summaryText,
        stored: true,
        blobName,
        blobUrl
      });
    } catch (error: any) {
      console.error("Session Summary Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI session summary." });
    }
  });

  // Server-Issued PIN & Session Creation Endpoint (POST /api/sessions/create)
  app.post("/api/sessions/create", createRateLimiter(60, 60, 60 * 1000), async (req, res) => {
    try {
      const { name, sourceLang, targetLang, topic, isDuoMode, speakerGender } = req.body || {};
      const pinDigits = process.env.SESSION_PIN_DIGITS ? Number(process.env.SESSION_PIN_DIGITS) : 8;
      const minPin = Math.pow(10, pinDigits - 1);
      const maxPin = Math.pow(10, pinDigits);
      const pinCode = crypto.randomInt(minPin, maxPin).toString();

      const hostToken = crypto.randomBytes(32).toString("hex");
      const sessionToken = crypto.randomBytes(32).toString("hex");
      const hostTokenHash = crypto.createHash("sha256").update(hostToken).digest("hex");

      const newSession: any = {
        speaker: null,
        organizerWs: null,
        organizerId: req.body?.userId || null,
        hostToken,
        hostTokenHash,
        sessionToken,
        sessionTokens: new Map([[sessionToken, Date.now() + 24 * 3600 * 1000]]),
        panelists: new Map(),
        pendingRequests: new Map(),
        languageGroups: new Map(),
        speakerGender: speakerGender || "female",
        topic: topic || "",
        isDuoMode: isDuoMode === true,
        messages: [],
        lastActivity: Date.now()
      };

      sessions.set(pinCode, newSession);
      observabilityService.recordSessionStart(pinCode);

      if (cosmosHealthState.configured) {
        try {
          const { getContainer } = await import("./src/lib/cosmos-client");
          const sessionsContainer = await getContainer("sessions");
          if (sessionsContainer) {
            await sessionsContainer.items.upsert({
              id: pinCode,
              name: name || `Live Session #${pinCode}`,
              createdAt: new Date().toISOString(),
              hostTokenHash,
              sessionToken,
              sourceLang: sourceLang || "en",
              targetLang: targetLang || "hi",
              status: "active"
            });
          }
        } catch (cErr) {
          console.warn("[SESSION_CREATE] Cosmos DB session write warning:", cErr);
        }
      }

      res.json({
        success: true,
        sessionId: pinCode,
        hostToken,
        sessionToken,
        createdAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("[SESSION_CREATE] Error creating session:", err);
      res.status(500).json({ error: "Failed to create session", message: err?.message || String(err) });
    }
  });


  // Azure Cognitive Services Translator API Endpoint
  app.post("/api/azure/translate", async (req, res) => {
    const { text, sourceLanguageCode, targetLanguageCode, sessionId } = req.body;
    const activeSessionId = (sessionId || req.headers["x-session-id"] || "").toString().trim();
    if (activeSessionId && sessions.has(activeSessionId)) {
      const sessionObj = sessions.get(activeSessionId);
      if (sessionObj) {
        const auth = verifySessionToken(req, sessionObj);
        if (!auth.valid) {
          if (auth.expired) {
            return res.status(403).json({ error: "Forbidden: Session token has expired. Please rejoin the session.", code: "SESSION_TOKEN_EXPIRED" });
          }
          return res.status(403).json({ error: "Forbidden: Valid sessionToken or hostToken is required", code: "SESSION_TOKEN_REQUIRED" });
        }
      }
    }
    const key = process.env.AZURE_TRANSLATOR_KEY;
    const region = process.env.AZURE_TRANSLATOR_REGION || "centralindia";

    if (!key) {
      return res.status(400).json({ error: "AZURE_TRANSLATOR_KEY not configured in .env" });
    }

    try {
      const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLanguageCode}${sourceLanguageCode ? `&from=${sourceLanguageCode}` : ''}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Ocp-Apim-Subscription-Region": region,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([{ text }])
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Azure Translator HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const translatedText = data[0]?.translations[0]?.text || text;
      res.json({ translatedText });
    } catch (error: any) {
      console.error("Azure Translator API Error:", error);
      res.status(500).json({ error: error.message || "Azure Translation Failed" });
    }
  });

  // Azure Gender-Aware Voice Mapping for Indian languages + English
  const AZURE_VOICE_MAP: Record<string, { female: string; male: string }> = {
    hi: { female: "hi-IN-SwaraNeural", male: "hi-IN-MadhurNeural" },
    gu: { female: "gu-IN-DhwaniNeural", male: "gu-IN-NiranjanNeural" },
    en: { female: "en-IN-NeerjaNeural", male: "en-IN-PrabhatNeural" },
    mr: { female: "mr-IN-AarohiNeural", male: "mr-IN-ManoharNeural" },
    ta: { female: "ta-IN-PallaviNeural", male: "ta-IN-ValluvarNeural" },
    te: { female: "te-IN-ShrutiNeural", male: "te-IN-MohanNeural" },
    bn: { female: "bn-IN-TanishaaNeural", male: "bn-IN-BashkarNeural" },
    kn: { female: "kn-IN-SapnaNeural", male: "kn-IN-GaganNeural" },
    ml: { female: "ml-IN-SobhanaNeural", male: "ml-IN-MidhunNeural" },
    pa: { female: "pa-IN-RaaviNeural", male: "pa-IN-OjasNeural" },
    ur: { female: "ur-IN-GulNeural", male: "ur-IN-SalmanNeural" },
    or: { female: "or-IN-SubhasiniNeural", male: "or-IN-SubhasiniNeural" },
    as: { female: "as-IN-YashicaNeural", male: "as-IN-YashicaNeural" }
  };

  const ALLOWED_AZURE_VOICES = new Set(
    Object.values(AZURE_VOICE_MAP).flatMap(v => [v.female, v.male])
  );

  function getAzureVoiceForLanguage(langCode: string, gender?: string): string {
    const cleanLang = (langCode || "hi").split("-")[0];
    const mapping = AZURE_VOICE_MAP[cleanLang];
    if (mapping) {
      return (gender === "male") ? mapping.male : mapping.female;
    }
    return `${cleanLang}-IN-Neural`;
  }

  // Resilient Text-to-Speech (TTS) API Endpoint with Azure + Google Neural Fallback
  const ttsRateLimiter = createRateLimiter(60, 120, 60 * 1000);
  app.post(["/api/azure/tts", "/api/tts"], ttsRateLimiter, async (req, res) => {
    const { text, languageCode, voiceName, gender, eventId: inputEventId, sessionId, token } = req.body || {};
    const activeSessionId = (sessionId || req.headers["x-session-id"] || "").toString().trim();
    if (!activeSessionId) {
      return res.status(400).json({ error: "Missing required sessionId", provider: "tts-error", truncated: false });
    }
    if (activeSessionId === "test_session" || activeSessionId === "global_test") {
      return res.status(403).json({ error: "Forbidden: Test bypasses are disabled", code: "SESSION_TOKEN_REQUIRED" });
    }
    if (!sessions.has(activeSessionId)) {
      return res.status(403).json({ error: "Forbidden: Invalid or non-existent sessionId", code: "SESSION_TOKEN_REQUIRED" });
    }

    const sessionObj = sessions.get(activeSessionId);
    const auth = verifySessionToken(req, sessionObj);
    if (!auth.valid) {
      if (auth.expired) {
        return res.status(403).json({ error: "Forbidden: Session token has expired. Please rejoin the session.", code: "SESSION_TOKEN_EXPIRED" });
      }
      return res.status(403).json({ error: "Forbidden: Valid sessionToken or hostToken is required", code: "SESSION_TOKEN_REQUIRED" });
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text field is required", provider: "tts-error", truncated: false });
    }
    if (text.length > 2000) {
      return res.status(400).json({ error: "Text length exceeds maximum allowed limit (2000 characters)", provider: "tts-error", truncated: true });
    }

    const eventId = inputEventId || generateEventId();
    const startTime = Date.now();
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || "centralindia";
    const cleanLang = (languageCode || "hi").split("-")[0];
    const cleanedText = cleanIndianText(text);
    const validatedVoice = (voiceName && ALLOWED_AZURE_VOICES.has(voiceName)) ? voiceName : getAzureVoiceForLanguage(cleanLang, gender);

    observabilityService.recordEvent({
      eventId,
      sessionId: activeSessionId || "global",
      sourceLanguage: "en",
      targetLanguage: cleanLang,
      stage: "TTS",
      eventType: "TTS_REQUEST",
      status: "SUCCESS",
      provider: key ? "azure-tts" : "google-tts-fallback",
      latencyMs: "NOT_MEASURED"
    });

    const cacheKey = ttsAudioCache.getCacheKey(cleanedText, cleanLang, validatedVoice, gender);

    try {
      const cachedOrSynthesized = await ttsAudioCache.getOrSynthesize(cacheKey, async () => {
        if (key) {
          try {
            const escapedText = escapeXml(cleanedText);
            const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='${languageCode || 'hi-IN'}'><voice name='${validatedVoice}'><prosody rate='1.02' pitch='+0Hz'>${escapedText}</prosody></voice></speak>`;
            const outputFormatHeader = "audio-24khz-96kbitrate-mono-mp3";

            console.log(`[AZURE_TTS][REQUEST] FormatHeader='${outputFormatHeader}' Voice='${validatedVoice}' Gender='${gender || 'default'}' SSML="${ssml}"`);

            const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Ocp-Apim-Subscription-Key": key,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": outputFormatHeader,
                "User-Agent": "BharatBridge"
              },
              body: ssml
            });

            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Azure TTS HTTP ${response.status}: ${errText}`);
            }

            const audioBuffer = await response.arrayBuffer();
            const contentType = response.headers.get("content-type") || "unknown";
            const byteSize = audioBuffer.byteLength;
            const headersMap: Record<string, string> = {};
            response.headers.forEach((v, k) => { headersMap[k] = v; });

            console.log(`[AZURE_TTS][RESPONSE] Status=${response.status} ContentType='${contentType}' ByteSize=${byteSize} bytes OutputFormatSent='${outputFormatHeader}' EventId='${eventId}' AzureHeaders=`, JSON.stringify(headersMap));

            const base64Audio = Buffer.from(audioBuffer).toString("base64");
            return {
              audio: base64Audio,
              format: "audio/mp3",
              byteSize,
              contentType,
              outputFormat: outputFormatHeader,
              provider: "azure-tts",
              truncated: false
            };
          } catch (error: any) {
            console.warn(`[TTS_PATH] Azure TTS failed (reason: '${error?.message || error}')`);
            if (process.env.DISABLE_TTS_FALLBACK === "true") {
              throw error;
            }
          }
        } else if (process.env.DISABLE_TTS_FALLBACK === "true") {
          throw new Error("AZURE_SPEECH_KEY not set and DISABLE_TTS_FALLBACK=true");
        }

        // High-availability Fallback: Universal Google Neural TTS Engine for Indian languages
        const isTruncated = (cleanedText || "").length > 200;
        const shortText = (cleanedText || "").slice(0, 200);
        const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(shortText)}&tl=${cleanLang}&client=tw-ob`;
        const response = await fetch(googleTtsUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (response.ok) {
          const audioBuffer = await response.arrayBuffer();
          const base64Audio = Buffer.from(audioBuffer).toString("base64");
          return {
            audio: base64Audio,
            format: "audio/mp3",
            provider: "google-tts-fallback",
            truncated: isTruncated
          };
        }
        throw new Error("TTS generation failed on both Azure and Google fallback");
      });

      const executionTimeMs = Date.now() - startTime;
      observabilityService.recordEvent({
        eventId,
        sessionId: activeSessionId || "global",
        sourceLanguage: "en",
        targetLanguage: cleanLang,
        stage: "TTS",
        eventType: "TTS_SUCCESS",
        status: "SUCCESS",
        provider: cachedOrSynthesized.provider,
        latencyMs: executionTimeMs,
        charCount: cleanedText.length
      });

      return res.json({
        ...cachedOrSynthesized,
        eventId
      });
    } catch (err: any) {
      const executionTimeMs = Date.now() - startTime;
      observabilityService.recordEvent({
        eventId,
        sessionId: activeSessionId || "global",
        sourceLanguage: "en",
        targetLanguage: cleanLang,
        stage: "TTS",
        eventType: "TTS_FAILURE",
        status: "FAILURE",
        provider: "tts-error",
        latencyMs: executionTimeMs,
        errorCode: "TTS_FAILURE",
        errorMessage: err?.message || "TTS synthesis error"
      });
      return res.status(500).json({ error: `TTS synthesis error: ${err?.message || err}`, provider: "tts-error", truncated: false });
    }
  });


  const broadcastRoomState = (session: SessionState) => {
    const activePanelistCount = session.panelists.size;
    const pendingList = Array.from(session.pendingRequests.values()).map(r => ({
      userId: r.userId,
      userName: r.userName,
      requestedAt: r.requestedAt,
      targetLang: r.targetLang
    }));
    const panelistList = Array.from(session.panelists.values()).map(p => ({
      speakerId: p.speakerId,
      userId: p.userId,
      userName: p.userName,
      active: p.ws.readyState === WebSocket.OPEN
    }));

    const payload = JSON.stringify({
      type: "room_state",
      topic: session.topic || "",
      name: session.topic || "Live Session",
      sourceLang: "en",
      activePanelistCount,
      maxPanelists: 10,
      pendingRequests: pendingList,
      panelists: panelistList
    });

    if (session.organizerWs && session.organizerWs.readyState === WebSocket.OPEN) {
      session.organizerWs.send(payload);
    }
    if (session.speaker && session.speaker.readyState === WebSocket.OPEN) {
      session.speaker.send(payload);
    }
    session.panelists.forEach(p => {
      if (p.ws.readyState === WebSocket.OPEN) p.ws.send(payload);
    });
    session.pendingRequests.forEach(r => {
      if (r.ws.readyState === WebSocket.OPEN) r.ws.send(payload);
    });
    session.languageGroups.forEach(g => {
      g.listeners.forEach(l => {
        if (l.readyState === WebSocket.OPEN) l.send(payload);
      });
    });
  };

  // Helper to get or create a language group and asynchronously initialize Gemini Live session
  const getOrCreateLanguageGroup = (sessionId: string, targetLang: string, gender: string): LanguageGroup | null => {
    const session = sessions.get(sessionId);
    if (!session) return null;
    const canonical = getCanonicalLanguageCode(targetLang);

    if (!session.languageGroups.has(canonical)) {
      session.languageGroups.set(canonical, { geminiSession: null, listeners: new Set() });
    }
    const group = session.languageGroups.get(canonical)!;

    if (!group.geminiSession && !group.isInitializing && process.env.GEMINI_API_KEY && process.env.ENABLE_GEMINI_LIVE === "true") {
      group.isInitializing = true;
      const targetLangName = LANGUAGE_NAME_MAP[canonical] || canonical;
      const liveModel = process.env.GEMINI_MODEL_LIVE || "gemini-2.0-flash-exp";
      const systemInstruction = `You are a real-time speech interpreter for BharatBridge. Listen to incoming audio and stream translated spoken text live in ${targetLangName}.`;

      ai.live.connect({
        model: liveModel,
        config: {
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          responseModalities: [Modality.TEXT]
        },
        callbacks: {
          onopen: () => {
            console.log(`[Gemini Live] Session connected for language group: ${canonical}`);
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.text) {
                  const payload = JSON.stringify({
                    type: "transcription",
                    eventId: generateEventId(),
                    originalText: "",
                    translatedText: part.text,
                    sourceLang: "auto",
                    targetLang: canonical,
                    isFinal: false,
                    speakerId: "speaker-01",
                    speakerName: "Speaker"
                  });
                  group.listeners.forEach((listenerWs) => {
                    if (listenerWs.readyState === WebSocket.OPEN) {
                      listenerWs.send(payload);
                    }
                  });
                }
              }
            }
          },
          onerror: (err: any) => {
            console.error(`[Gemini Live Error] group=${canonical}:`, err);
          },
          onclose: () => {
            console.log(`[Gemini Live Closed] group=${canonical}`);
            group.geminiSession = null;
          }
        }
      }).then((liveSession) => {
        group.geminiSession = liveSession;
        group.isInitializing = false;
      }).catch((err) => {
        console.warn(`[Gemini Live Connect Failed] group=${canonical}:`, err);
        group.geminiSession = null;
        group.isInitializing = false;
      });
    }

    return group;
  };

  // Phase 1: Active Language Discovery Helper Functions
  const getActiveLanguages = (sessionId: string): string[] => {
    const session = sessions.get(sessionId);
    if (!session) return [];
    const activeLangs: string[] = [];
    session.languageGroups.forEach((group, langCode) => {
      const openSockets = Array.from(group.listeners).filter(ws => ws.readyState === WebSocket.OPEN);
      if (openSockets.length > 0) {
        activeLangs.push(getCanonicalLanguageCode(langCode));
      }
    });
    return activeLangs;
  };


  const addListenerToLanguageGroup = (sessionId: string, targetLang: string, ws: WebSocket): void => {
    const session = sessions.get(sessionId);
    if (!session) return;
    const canonical = getCanonicalLanguageCode(targetLang);
    const group = getOrCreateLanguageGroup(sessionId, canonical, session.speakerGender);
    if (group) {
      group.listeners.add(ws);
    }
  };

  const removeListenerFromLanguageGroup = (sessionId: string, targetLang: string, ws: WebSocket): void => {
    const session = sessions.get(sessionId);
    if (!session) return;
    const canonical = getCanonicalLanguageCode(targetLang);
    const group = session.languageGroups.get(canonical);
    if (group) {
      group.listeners.delete(ws);
      if (group.listeners.size === 0) {
        if (group.geminiSession) group.geminiSession.close();
        session.languageGroups.delete(canonical);
      }
    }
  };


  // Phase 1: Single-Flight In-Memory Deduplication Cache (Single-server development mode)
  // NOTE: THIS IS NOT YET A MULTI-INSTANCE DISTRIBUTED LOCK.
  type SingleFlightCacheValue = {
    status: 'processing' | 'completed';
    promise?: Promise<TranslationResultFoundation>;
    result?: TranslationResultFoundation;
    timestamp: number;
  };
  const singleFlightProcessingCache = new Map<string, SingleFlightCacheValue>();

  // Sequence Number Tracker per (sessionId + speakerId)
  const sessionSequenceTracker = new Map<string, number>();

  const getLastSequenceNumber = (sessionId: string, speakerId: string = "speaker-01"): number => {
    const key = `${sessionId}:${speakerId}`;
    return sessionSequenceTracker.get(key) || 0;
  };

  const setLastSequenceNumber = (sessionId: string, speakerId: string, seq: number): void => {
    const key = `${sessionId}:${speakerId}`;
    sessionSequenceTracker.set(key, seq);
  };

  // Active Thought Buffer per (sessionId + speakerId) for Contextual Live Interpretation
  interface ActiveThoughtBuffer {
    sessionId: string;
    speakerId: string;
    speakerName: string;
    fragments: string[];
    sourceLanguage: string;
    firstSequenceNumber: number;
    latestSequenceNumber: number;
    firstEventId: string;
    latestEventId: string;
    createdTimestamp: number;
    lastFragmentTimestamp: number;
    flushTimer: NodeJS.Timeout | null;
  }

  const activeThoughtBuffers = new Map<string, ActiveThoughtBuffer>();

  const flushThoughtBuffer = async (sessionId: string, speakerId: string) => {
    const bufferKey = `${sessionId}:${speakerId}`;
    const buffer = activeThoughtBuffers.get(bufferKey);
    if (!buffer || buffer.fragments.length === 0) return;

    // Atomically clear timer and remove buffer entry from active map BEFORE async translation begins
    if (buffer.flushTimer) {
      clearTimeout(buffer.flushTimer);
      buffer.flushTimer = null;
    }
    activeThoughtBuffers.delete(bufferKey);

    const accumulatedText = buffer.fragments.join(" ").trim();
    if (!accumulatedText) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    const activeLanguages = getActiveLanguages(sessionId);
    const targetLangsToTranslate = activeLanguages.length > 0 ? activeLanguages : ["hi"];
    const canonicalSource = getCanonicalLanguageCode(buffer.sourceLanguage || "en");
    const recentContext = (session.messages || []).slice(0, 3).map(m => ({ originalText: m.originalText, translatedText: m.translatedText }));

    console.log(`[BHARATBRIDGE][THOUGHT_BUFFER_FLUSH] session='${sessionId}' speaker='${speakerId}' fragments=${buffer.fragments.length} accumulatedText="${accumulatedText}" eventId='${buffer.latestEventId}'`);

    // Store base record in session.messages history
    const baseRecord: SessionMessage = {
      originalText: accumulatedText,
      translatedText: "",
      targetLang: "",
      sourceLang: canonicalSource,
      timestamp: Date.now(),
      speakerId,
      speakerName: buffer.speakerName,
      eventId: buffer.latestEventId,
      translations: {}
    };
    const existingIdx = (session.messages || []).findIndex(m => (m as any).eventId === buffer.latestEventId || (m as any).id === buffer.latestEventId);
    if (existingIdx < 0) {
      session.messages.push(baseRecord);
      if (session.messages.length > 100) session.messages.shift();
    }

    // Instantly persist base document (original text + empty translations) regardless of connected listeners
    if (cosmosHealthState.configured) {
      upsertFinalizedThoughtDocument({
        eventId: buffer.latestEventId,
        sessionId,
        speakerId,
        speakerName: buffer.speakerName,
        sequenceNumber: buffer.latestSequenceNumber,
        originalText: accumulatedText,
        sourceLang: canonicalSource,
        translations: {},
        degraded: false
      }).catch((err) => {
        console.warn("[CosmosDB] Async base document notice:", err);
      });
    }

    const accumulatedTranslations: Record<string, { text: string; provider: string; degraded: boolean }> = {};
    let isOverallDegraded = false;

    const translationTasks = targetLangsToTranslate.map(async (targetLang) => {
      try {
        const canonicalTarget = getCanonicalLanguageCode(targetLang);
        let translatedText = accumulatedText;
        let latencyMs = 0;

        const targetContext = (session.messages || [])
          .filter(m => getCanonicalLanguageCode(m.targetLang || (m as any).translatedLanguage || "hi") === canonicalTarget)
          .slice(-3)
          .map(m => ({ originalText: m.originalText, translatedText: m.translatedText }));

        let result: TranslationResultFoundation | null = null;
        if (canonicalTarget !== canonicalSource) {
          result = await translateSpeechEvent({
            eventId: buffer.latestEventId,
            sessionId,
            speakerId,
            sourceLanguage: canonicalSource,
            sourceText: accumulatedText,
            sequenceNumber: buffer.latestSequenceNumber,
            context: targetContext,
            topic: session.topic,
            speakerGender: session.speakerGender
          }, canonicalTarget);

          translatedText = result.translatedText;
          latencyMs = result.latencyMs;
        }

        const isDegradedResult = result ? (result.degraded || result.provider === "untranslated") : false;
        if (isDegradedResult) isOverallDegraded = true;

        accumulatedTranslations[canonicalTarget] = {
          text: translatedText,
          provider: result ? result.provider : "same-language",
          degraded: isDegradedResult
        };

        const group = session.languageGroups.get(canonicalTarget);
        console.log(`[DIAGNOSTIC][STEP2_BROADCAST_SPEECH_EVENT] sessionId='${sessionId}' targetLang='${targetLang}' canonicalTarget='${canonicalTarget}' availableGroups=[${Array.from(session.languageGroups.keys()).join(', ')}] groupExists=${!!group} listenersCount=${group?.listeners.size || 0}`);
        if (group && group.listeners.size > 0) {
          const listenerPayload = JSON.stringify({
            type: "transcription",
            eventId: buffer.latestEventId,
            originalText: accumulatedText,
            translatedText,
            sourceLang: canonicalSource,
            targetLang: canonicalTarget,
            isFinal: true,
            speakerId,
            speakerName: buffer.speakerName,
            sequenceNumber: buffer.latestSequenceNumber,
            provider: result ? result.provider : "same-language",
            translation_degraded: isDegradedResult
          });

          group.listeners.forEach((listenerWs) => {
            console.log(`[DIAGNOSTIC][STEP3_SOCKET_STATE_SPEECH_EVENT] listenerWs.readyState=${listenerWs.readyState} (OPEN=1) targetLang='${canonicalTarget}'`);
            if (listenerWs.readyState === WebSocket.OPEN) {
              listenerWs.send(listenerPayload);
            }
          });

          observabilityService.recordEvent({
            eventId: buffer.latestEventId,
            sessionId,
            speakerId,
            sourceLanguage: canonicalSource,
            targetLanguage: canonicalTarget,
            stage: "WEBSOCKET",
            eventType: "WS_BROADCAST",
            status: "SUCCESS",
            latencyMs
          });
        }

        // Store target translation into in-memory session.messages
        const msgIdx = (session.messages || []).findIndex(m => (m as any).eventId === buffer.latestEventId || (m as any).id === buffer.latestEventId);
        if (msgIdx >= 0) {
          const currentMsg = session.messages[msgIdx];
          const currentTranslations = currentMsg.translations || {};
          currentTranslations[canonicalTarget] = translatedText;
          session.messages[msgIdx] = {
            ...currentMsg,
            translatedText,
            targetLang: canonicalTarget,
            degraded: currentMsg.degraded || isDegradedResult,
            translations: currentTranslations
          };
        }
      } catch (err: any) {
        console.error(`[BHARATBRIDGE][THOUGHT_BUFFER] Error processing target language '${targetLang}':`, err);
      }
    });

    await Promise.allSettled(translationTasks);

    if (cosmosHealthState.configured && Object.keys(accumulatedTranslations).length > 0) {
      await upsertFinalizedThoughtDocument({
        eventId: buffer.latestEventId,
        sessionId,
        speakerId,
        speakerName: buffer.speakerName,
        sequenceNumber: buffer.latestSequenceNumber,
        originalText: accumulatedText,
        sourceLang: canonicalSource,
        translations: accumulatedTranslations,
        degraded: isOverallDegraded
      }).catch((err) => {
        console.warn("[CosmosDB] Async translation merge notice:", err);
      });
    }

  };

  // Phase 1: Translation Orchestration Foundation Interface
  interface TranslationResultFoundation {
    eventId: string;
    sessionId: string;
    speakerId: string;
    sourceLanguage: string;
    targetLanguage: string;
    originalText: string;
    translatedText: string;
    provider: string;
    status: 'SUCCESS' | 'FALLBACK' | 'FAILURE';
    degraded: boolean;
    latencyMs: number;
    sequenceNumber: number;
  }

  async function translateSpeechEvent(
    speechEvent: {
      eventId: string;
      sessionId: string;
      speakerId: string;
      sourceLanguage: string;
      sourceText: string;
      sequenceNumber: number;
      context?: Array<{ originalText: string; translatedText: string }>;
      topic?: string;
      speakerGender?: string;
    },
    targetLanguage: string
  ): Promise<TranslationResultFoundation> {
    const startTime = Date.now();
    const canonicalTarget = getCanonicalLanguageCode(targetLanguage);
    const canonicalSource = getCanonicalLanguageCode(speechEvent.sourceLanguage);
    const processingKey = `${speechEvent.sessionId}:${speechEvent.eventId}:${canonicalTarget}`;

    if (singleFlightProcessingCache.has(processingKey)) {
      const cached = singleFlightProcessingCache.get(processingKey)!;
      if (cached.status === 'completed' && cached.result) {
        return cached.result;
      }
      if (cached.status === 'processing' && cached.promise) {
        return await cached.promise;
      }
    }

    const executionPromise = (async (): Promise<TranslationResultFoundation> => {
      try {
        const transRes = await generateTranslationWithGemini(
          speechEvent.sourceText,
          speechEvent.sourceText,
          canonicalTarget,
          canonicalSource,
          speechEvent.context,
          speechEvent.topic,
          speechEvent.speakerGender
        );

        const result: TranslationResultFoundation = {
          eventId: speechEvent.eventId,
          sessionId: speechEvent.sessionId,
          speakerId: speechEvent.speakerId,
          sourceLanguage: canonicalSource,
          targetLanguage: canonicalTarget,
          originalText: speechEvent.sourceText,
          translatedText: transRes.text,
          provider: transRes.provider,
          status: transRes.degraded ? 'FALLBACK' : 'SUCCESS',
          degraded: transRes.degraded,
          latencyMs: Date.now() - startTime,
          sequenceNumber: speechEvent.sequenceNumber
        };

        if (!result.degraded && result.status === 'SUCCESS' && result.provider !== 'untranslated') {
          singleFlightProcessingCache.set(processingKey, { status: 'completed', result, timestamp: Date.now() });
          setTimeout(() => singleFlightProcessingCache.delete(processingKey), 60000);
        }
        return result;
      } catch (error: any) {
        const failureResult: TranslationResultFoundation = {
          eventId: speechEvent.eventId,
          sessionId: speechEvent.sessionId,
          speakerId: speechEvent.speakerId,
          sourceLanguage: canonicalSource,
          targetLanguage: canonicalTarget,
          originalText: speechEvent.sourceText,
          translatedText: speechEvent.sourceText,
          provider: 'untranslated',
          status: 'FAILURE',
          degraded: true,
          latencyMs: Date.now() - startTime,
          sequenceNumber: speechEvent.sequenceNumber
        };
        singleFlightProcessingCache.set(processingKey, { status: 'completed', result: failureResult, timestamp: Date.now() });
        return failureResult;
      }
    })();

    singleFlightProcessingCache.set(processingKey, { status: 'processing', promise: executionPromise, timestamp: Date.now() });
    return await executionPromise;
  }


  async function generateTranslationWithGemini(
    promptOrText: string, 
    rawText?: string, 
    targetLangCode?: string, 
    sourceLangCode?: string,
    context?: Array<{ originalText: string; translatedText: string }>,
    topicOrGlossary?: string,
    speakerGender?: string
  ): Promise<{ text: string; provider: string; degraded: boolean }> {
    const cleanText = cleanIndianText(rawText || promptOrText);
    if (!cleanText) return { text: "", provider: "none", degraded: false };
    const cleanTargetCode = (targetLangCode || "hi").split("-")[0];
    const targetLangName = LANGUAGE_NAME_MAP[cleanTargetCode] || cleanTargetCode;
    const isAutoDetectSource = !sourceLangCode || sourceLangCode === 'auto' || sourceLangCode === 'auto-detect';
    const sourceLangName = isAutoDetectSource ? "the original language (auto-detected)" : (LANGUAGE_NAME_MAP[sourceLangCode.split("-")[0]] || sourceLangCode);

    // 1. Primary Engine: Gemini AI Context-Aware Natural Translation
    const last3Context = context && context.length > 0 ? context.slice(-3) : [];
    const contextPrompt = last3Context.length > 0 
      ? `previous context (do not re-translate):\n${last3Context.map((c, idx) => `[${idx + 1}] Original: "${c.originalText}" -> Translated: "${c.translatedText}"`).join("\n")}\n\n`
      : "";

    const topicPrompt = topicOrGlossary && topicOrGlossary.trim()
      ? `Event Topic / Glossary:\n${topicOrGlossary.trim()}\n\n`
      : "";

    const genderPrompt = speakerGender && (speakerGender === 'male' || speakerGender === 'female')
      ? `Speaker Gender: ${speakerGender}. Ensure all first-person verbs and agreement forms grammatically match a ${speakerGender} speaker in ${targetLangName} (e.g. रही हूँ vs रहा हूँ in Hindi, or રહી છું vs રહ્યો છું in Gujarati).\n`
      : `Speaker Gender is unspecified. Use gender-neutral phrasing and forms in ${targetLangName} whenever possible, rather than defaulting to masculine forms.\n`;

    const isTargetEnglish = cleanTargetCode === 'en';
    const systemPrompt = isTargetEnglish
      ? `You are an elite, culturally fluent human interpreter providing live simultaneous interpretation into natural spoken English.

CORE INTERPRETATION MANDATES:
1. IDIOMATIC & CONTEXTUAL MEANING (CRITICAL):
   - When interpreting from Indian languages (e.g. Hindi, Gujarati, Marathi, Tamil, Telugu, Bengali) into English, translate the UNDERLYING INTENT into authentic, natural conversational English expressions that native English speakers naturally use in conversation.
   - Re-express Indian idioms, metaphors, and colloquial expressions into their natural English equivalents (e.g., "काम की लय पकड़ना" -> "getting into the groove", "एक ही बात पर सहमत होना" -> "on the same page", "लीक से हटकर सोचना" -> "think outside the box", "पते की बात कहना" -> "hit the nail on the head").

2. SCRIPT & LANGUAGE STRICTNESS:
   - Output ONLY in standard English using Latin script. NEVER output Indian language script (Devanagari, Gujarati, etc.) when English target is requested!

3. PROPER NOUNS & NAMES:
   - Preserve proper nouns (people's names, place names, brand/project names like 'BharatBridge', 'Shrushti', 'Priya', 'Ahmedabad') in standard English spelling (e.g., 'सृष्टि' -> 'Shrushti', 'डॉ. प्रिया' -> 'Dr. Priya').

4. CONVERSATIONAL RHYTHM & GRAMMAR:
   - Use standard English Subject-Verb-Object (SVO) word order and smooth, polite conversational flow.

${topicPrompt}${genderPrompt}${contextPrompt}STRICT INSTRUCTIONS:
1. Translate ONLY the new sentence below naturally from ${sourceLangName} to English.
2. Use previous conversation context to resolve pronouns and maintain seamless continuity.
3. If the sentence is incomplete, translate what is present naturally without fabricating facts.
4. Output ONLY the clean final translated text in English. Do NOT include quotes, explanations, or notes.

New Sentence: "${cleanText}"`
      : `You are an elite, culturally fluent human interpreter providing live simultaneous interpretation into natural spoken ${targetLangName}.

CORE INTERPRETATION MANDATES:
1. IDIOMATIC & CONTEXTUAL MEANING (CRITICAL):
   - Translate the UNDERLYING INTENT and CONTEXT of the speaker into authentic, culturally natural spoken expressions in ${targetLangName} that a native speaker would naturally use in conversation.
   - For English idioms, metaphors, or figures of speech (e.g., "on the same page", "hit the nail on the head", "getting into the groove", "think outside the box", "circle back"), ALWAYS translate the true conversational meaning into ${targetLangName} (e.g. "on the same page" -> "एक ही बात पर सहमत होना / समान राय होना", "hit the nail on the head" -> "बिल्कुल सटीक / पते की बात कहना", "getting into the groove" -> "काम की लय / रफ़्तार पकड़ना", "think outside the box" -> "लीक से हटकर सोचना"). Do NOT perform literal dictionary translation.

2. SCRIPT & LANGUAGE STRICTNESS:
   - Output ONLY in the native script of ${targetLangName} (e.g. Gujarati script for Gujarati, Devanagari script for Hindi/Marathi, Tamil script for Tamil). NEVER output Devanagari Hindi text when Gujarati or another target language is requested!

3. PROPER NOUNS & NAMES:
   - Do NOT translate proper nouns (people's names, place names, brand/project names like 'BharatBridge', 'Shrushti', 'Priya', 'Ahmedabad') for their literal dictionary meanings. Preserve them as names and transliterate them phonetically into the native script of ${targetLangName} (e.g. 'Shrushti' -> 'सृष्टि' in Hindi, 'શ્રુષ્ટિ' in Gujarati; 'Dr. Priya' -> 'डॉ. प्रिया' in Hindi, 'ડૉ. પ્રિયા' in Gujarati).

4. CONVERSATIONAL RHYTHM & GRAMMAR:
   - Use natural Subject-Object-Verb (SOV) order for Indian languages. Ensure polite conversational flow.

${topicPrompt}${genderPrompt}${contextPrompt}STRICT INSTRUCTIONS:
1. Translate ONLY the new sentence below naturally from ${sourceLangName} to ${targetLangName}.
2. Use previous conversation context to resolve pronouns and maintain seamless continuity.
3. If the sentence is incomplete, translate what is present naturally without fabricating facts.
4. Output ONLY the clean final translated text in ${targetLangName} script. Do NOT include quotes, explanations, or notes.

New Sentence: "${cleanText}"`;

    const primaryModel = process.env.GEMINI_MODEL_TRANSLATION || "gemini-3.8-flash";
    const timeoutMs = Number(process.env.TRANSLATION_TIMEOUT_MS) || 3500;
    const startTime = Date.now();
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiPromise = ai.models.generateContent({
          model: primaryModel,
          contents: systemPrompt,
          config: { 
            temperature: 0.1,
            maxOutputTokens: 150,
            thinkingConfig: { thinkingBudget: 0 } as any // Off/minimal thinking for low-latency translation
          }
        });

        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Gemini ${primaryModel} timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        const result = await Promise.race([geminiPromise, timeoutPromise]);
        const latencyMs = Date.now() - startTime;
        const promptTokens = (result as any).usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = (result as any).usageMetadata?.candidatesTokenCount || 0;
        const thoughtsTokens = (result as any).usageMetadata?.thoughtsTokenCount || 0;

        if (result.text && result.text.trim()) {
          const cleaned = cleanIndianText(result.text.trim().replace(/^["']|["']$/g, ''));
          if (cleaned) {
            console.log(`[BHARATBRIDGE][TRANSLATION_SUCCESS] provider='gemini' model='${primaryModel}' latencyMs=${latencyMs}ms promptTokens=${promptTokens} candidatesTokens=${candidatesTokens} thoughtsTokenCount=${thoughtsTokens} fallbackFired=false thinkingBudget=0 text="${cleaned.slice(0, 30)}..."`);
            return { text: cleaned, provider: "gemini", degraded: false };
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        let reason = "UNKNOWN_ERROR";
        if (errMsg.includes("timed out")) reason = "TIMEOUT";
        else if (errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("RESOURCE_EXHAUSTED")) reason = "429_RATE_LIMIT";
        else if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("Overloaded")) reason = "503_UNAVAILABLE";
        else if (errMsg.includes("JSON")) reason = "INVALID_JSON";
        console.warn(`[GEMINI][TRANSLATION_FALLBACK_REASON] Model='${primaryModel}' reason='${reason}' details='${errMsg}'`);
      }
    }

    // 2. Azure Translator API Fallback (Primary fallback for high quality)
    const azureKey = process.env.AZURE_TRANSLATOR_KEY;
    const azureRegion = process.env.AZURE_TRANSLATOR_REGION || "centralindia";
    if (azureKey && cleanText && cleanTargetCode) {
      try {
        const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${cleanTargetCode}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": azureKey,
            "Ocp-Apim-Subscription-Region": azureRegion,
            "Content-Type": "application/json"
          },
          body: JSON.stringify([{ text: cleanText }])
        });
        if (response.ok) {
          const data = await response.json();
          const translatedText = data[0]?.translations[0]?.text;
          if (translatedText) {
            return { text: applyGenderAgreementFallback(translatedText, cleanTargetCode, speakerGender), provider: "azure-translator-fallback", degraded: true };
          }
        }
      } catch (e) {
        console.warn("[Azure Translation] Error:", e);
      }
    }

    // 3. Emergency Universal Google Translate Fallback (Zero quota limit, instant sub-100ms response)
    if (cleanText && cleanTargetCode) {
      try {
        const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${cleanTargetCode}&dt=t&q=${encodeURIComponent(cleanText)}`;
        const gRes = await fetch(gUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (Array.isArray(gData) && gData[0]) {
            const gText = gData[0].map((item: any) => item[0]).filter(Boolean).join("");
            if (gText && gText.trim()) {
              return { text: applyGenderAgreementFallback(gText.trim(), cleanTargetCode, speakerGender), provider: "google-translate-fallback", degraded: true };
            }
          }
        }
      } catch (gErr) {
        console.warn("[Google Translate Fallback] Error:", gErr);
      }
    }

    return { text: cleanIndianText(cleanText), provider: "untranslated", degraded: true };
  }

  // Server-Side Admin Access Verification Guard
  async function verifyAdminAccess(req: any): Promise<boolean> {
    const adminTokenHeader = (req.headers["x-admin-token"] || "").toString().trim();
    const authHeader = (req.headers["authorization"] || "").toString().trim();
    const envAdminToken = (process.env.ADMIN_TOKEN || "").trim();
    const envAdminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);

    let clientSecretToken = adminTokenHeader;
    let bearerToken = "";
    if (authHeader.startsWith("Bearer ")) {
      bearerToken = authHeader.substring(7).trim();
      if (!clientSecretToken && envAdminToken && timingSafeEqualToken(bearerToken, envAdminToken)) {
        clientSecretToken = bearerToken;
      }
    }

    const isAllowedBySecretToken = Boolean(
      envAdminToken &&
      clientSecretToken &&
      timingSafeEqualToken(clientSecretToken, envAdminToken)
    );

    let decodedToken: any = null;
    let isAllowedByEmail = false;
    let isAllowedByClaim = false;

    if (bearerToken && !isAllowedBySecretToken) {
      const adminAuth = getAdminAuth();
      if (adminAuth) {
        try {
          decodedToken = await adminAuth.verifyIdToken(bearerToken);
          if (decodedToken) {
            const tokenEmail = (decodedToken.email || "").toLowerCase().trim();
            if (tokenEmail && envAdminEmails.includes(tokenEmail)) {
              isAllowedByEmail = true;
            }
            if (decodedToken.admin === true || decodedToken.role === "admin") {
              isAllowedByClaim = true;
            }
          }
        } catch (verifyErr: any) {
          decodedToken = null;
        }
      }
    }


    return isAllowedBySecretToken || isAllowedByEmail || isAllowedByClaim;
  }

  // Admin Sessions List Endpoint (GET /api/admin/sessions)
  app.get("/api/admin/sessions", async (req, res) => {
    if (!(await verifyAdminAccess(req))) {
      return res.status(403).json({ error: "Forbidden: Admin authorization required" });
    }

    try {
      const activeList = Array.from(sessions.entries()).map(([id, s]) => {
        const activeListeners = Array.from(s.languageGroups.values()).reduce((sum: number, g: any) => sum + g.listeners.size, 0);
        const createdAt = (s as any).createdAt || s.lastActivity || Date.now();
        const durationSec = Math.max(0, Math.round((Date.now() - createdAt) / 1000));
        return {
          id,
          name: s.topic || `Session ${id}`,
          sourceLang: "en",
          targetLang: Array.from(s.languageGroups.keys()).join(", ") || "hi",
          createdAt,
          lastActivity: s.lastActivity,
          durationSec,
          messageCount: s.messages?.length || 0,
          activeListeners,
          isLive: true
        };
      });

      let cosmosSessions: any[] = [];
      if (cosmosHealthState.configured) {
        try {
          const client = getCosmosClient();
          if (client) {
            const db = client.database(process.env.COSMOS_DB_DATABASE_NAME || "bharatbridge");
            const container = db.container("sessions");
            const { resources } = await container.items.query("SELECT TOP 50 * FROM c ORDER BY c._ts DESC").fetchAll();
            cosmosSessions = resources.map((doc: any) => {
              const createdAt = doc.createdAt || (doc._ts ? doc._ts * 1000 : Date.now());
              const lastActivity = doc.lastActivity || doc.updatedAt || createdAt;
              const durationSec = Math.max(0, Math.round((lastActivity - createdAt) / 1000));
              return {
                id: doc.id,
                name: doc.topic || doc.name || `Session ${doc.id}`,
                sourceLang: doc.sourceLang || "en",
                targetLang: doc.targetLang || "hi",
                createdAt,
                lastActivity,
                durationSec,
                messageCount: doc.messageCount || doc.messages?.length || 0,
                activeListeners: 0,
                isLive: false
              };
            });
          }
        } catch (cErr: any) {
          console.warn("[ADMIN_API] Cosmos DB sessions fetch notice:", cErr?.message || cErr);
        }
      }

      const mergedMap = new Map<string, any>();
      for (const cs of cosmosSessions) mergedMap.set(cs.id, cs);
      for (const as of activeList) mergedMap.set(as.id, { ...mergedMap.get(as.id), ...as, isLive: true });

      const resultList = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return res.json({ sessions: resultList });
    } catch (err: any) {
      console.error("[ADMIN_API] Error listing sessions:", err);
      return res.status(500).json({ error: "Internal server error fetching admin sessions" });
    }
  });

  // Admin Session Messages Endpoint (GET /api/admin/sessions/:id/messages)
  app.get("/api/admin/sessions/:id/messages", async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing session id parameter" });

    const isAdmin = await verifyAdminAccess(req);
    const targetSession = sessions.get(id);
    const isSessionHost = targetSession ? verifySessionToken(req, targetSession).valid : false;

    if (!isAdmin && !isSessionHost) {
      return res.status(403).json({ error: "Forbidden: Admin authorization or valid session host token required" });
    }

    try {
      const memorySession = sessions.get(id);
      let memoryMessages: any[] = memorySession?.messages || [];
      let cosmosMessages: any[] = [];

      if (cosmosHealthState.configured) {
        try {
          const client = getCosmosClient();
          if (client) {
            const db = client.database(process.env.COSMOS_DB_DATABASE_NAME || "bharatbridge");
            const container = db.container("messages");
            const querySpec = {
              query: "SELECT * FROM c WHERE c.sessionId = @sessionId ORDER BY c.timestamp ASC",
              parameters: [{ name: "@sessionId", value: id }]
            };
            const { resources } = await container.items.query(querySpec).fetchAll();
            cosmosMessages = resources;
          }
        } catch (cErr: any) {
          console.warn("[ADMIN_API] Cosmos DB messages fetch notice:", cErr?.message || cErr);
        }
      }

      const mergedMap = new Map<string, any>();
      for (const cm of cosmosMessages) {
        const key = cm.eventId || cm.id;
        if (key) mergedMap.set(key, cm);
      }
      for (const mm of memoryMessages) {
        const key = mm.eventId || mm.id;
        if (key) {
          const existing = mergedMap.get(key) || {};
          mergedMap.set(key, { ...existing, ...mm });
        }
      }

      const rawMessages = Array.from(mergedMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const formattedMessages = rawMessages.map((m, idx) => {
        let textOut = m.translatedText || "";
        if (!textOut && typeof m.translations === "object" && m.translations !== null) {
          const firstVal = Object.values(m.translations)[0] as any;
          if (typeof firstVal === "string") textOut = firstVal;
          else if (firstVal && typeof firstVal.text === "string") textOut = firstVal.text;
        }

        return {
          id: m.eventId || m.id || `msg-${idx}`,
          originalText: m.originalText || m.text || "",
          translatedText: textOut,
          sourceLang: m.sourceLang || "en",
          targetLang: m.targetLang || "hi",
          timestamp: m.timestamp || Date.now(),
          speakerName: m.speakerName || "Speaker"
        };
      });

      return res.json({ messages: formattedMessages });
    } catch (err: any) {
      console.error("[ADMIN_API] Error fetching session messages:", err);
      return res.status(500).json({ error: "Internal server error fetching session messages" });
    }
  });

  // API Routes
  app.post("/api/translate", async (req, res) => {
    const { text, sourceLanguage, targetLanguage, context, eventId: inputEventId, sessionId, token, speakerGender } = req.body || {};
    const activeSessionId = (sessionId || req.headers["x-session-id"] || "").toString().trim();

    if (!activeSessionId) {
      // Practice mode: no sessionId passed
      if (!text || typeof text !== "string" || !text.trim() || !targetLanguage) {
        return res.status(400).json({ error: "Missing text or targetLanguage" });
      }
      if (text.length > 500) {
        return res.status(400).json({ error: "Practice mode text length exceeds maximum allowed limit (500 characters)" });
      }
    } else {
      // In-session mode
      if (activeSessionId === "test_session" || activeSessionId === "global_test") {
        return res.status(403).json({ error: "Forbidden: Test bypasses are disabled", code: "SESSION_TOKEN_REQUIRED" });
      }
      if (!sessions.has(activeSessionId)) {
        return res.status(403).json({ error: "Forbidden: Invalid or non-existent sessionId", code: "SESSION_TOKEN_REQUIRED" });
      }
      const sessionObj = sessions.get(activeSessionId);
      const auth = verifySessionToken(req, sessionObj);
      if (!auth.valid) {
        if (auth.expired) {
          return res.status(403).json({ error: "Forbidden: Session token has expired. Please rejoin the session.", code: "SESSION_TOKEN_EXPIRED" });
        }
        return res.status(403).json({ error: "Forbidden: Valid sessionToken or hostToken is required", code: "SESSION_TOKEN_REQUIRED" });
      }
      if (!text || typeof text !== "string" || !text.trim() || !targetLanguage) {
        return res.status(400).json({ error: "Missing text or targetLanguage" });
      }
      if (text.length > 2000) {
        return res.status(400).json({ error: "Text length exceeds maximum allowed limit (2000 characters)" });
      }
    }
    const eventId = inputEventId || generateEventId();
    const startTime = Date.now();
    try {
      const targetLangCode = (LANGUAGE_NAME_MAP[targetLanguage.toLowerCase()] ? targetLanguage.toLowerCase() : Object.keys(LANGUAGE_NAME_MAP).find(k => LANGUAGE_NAME_MAP[k].toLowerCase() === targetLanguage.toLowerCase())) || targetLanguage || 'hi';
      const cleanSource = (sourceLanguage || "").toString().trim().toLowerCase();
      const sourceLangCode = (!cleanSource || cleanSource === "auto" || cleanSource === "auto-detect")
        ? "auto"
        : ((LANGUAGE_NAME_MAP[cleanSource] ? cleanSource : Object.keys(LANGUAGE_NAME_MAP).find(k => LANGUAGE_NAME_MAP[k].toLowerCase() === cleanSource)) || sourceLanguage || "auto");
      
      const transResult = await generateTranslationWithGemini(text, text, targetLangCode, sourceLangCode, context, undefined, speakerGender);
      const executionTimeMs = Date.now() - startTime;
      console.log("[BHARATBRIDGE][TRANSLATION_RESPONSE] Server /api/translate output:", transResult);

      if (transResult.provider === "untranslated") {
        observabilityService.recordEvent({
          eventId,
          sessionId: "global",
          sourceLanguage: sourceLangCode,
          targetLanguage: targetLangCode,
          stage: "TRANSLATION",
          eventType: "TRANSLATION_FAILURE",
          status: "FAILURE",
          provider: "untranslated",
          latencyMs: executionTimeMs,
          errorCode: "TRANSLATION_FAILURE"
        });
        return res.status(503).json({
          error: "Translation service failed to translate content",
          fallback: true,
          translatedText: text,
          eventId,
          executionTimeMs,
          provider: "untranslated",
          translation_degraded: true
        });
      }

      observabilityService.recordEvent({
        eventId,
        sessionId: "global",
        sourceLanguage: sourceLangCode,
        targetLanguage: targetLangCode,
        stage: "TRANSLATION",
        eventType: transResult.degraded ? "TRANSLATION_FALLBACK" : "TRANSLATION_SUCCESS",
        status: transResult.degraded ? "FALLBACK" : "SUCCESS",
        provider: transResult.provider,
        latencyMs: executionTimeMs
      });

      if (sessions.has(activeSessionId)) {
        const session = sessions.get(activeSessionId)!;
        const now = Date.now();
        const newMsg: SessionMessage = {
          originalText: text.trim(),
          translatedText: transResult.text,
          sourceLang: sourceLangCode,
          targetLang: targetLangCode,
          timestamp: now,
          speakerId: "speaker-api",
          speakerName: "Speaker",
          eventId,
          provider: transResult.provider,
          degraded: transResult.degraded,
          translations: { [targetLangCode]: transResult.text }
        };
        const existingIdx = (session.messages || []).findIndex(m => (m as any).eventId === eventId || (m as any).id === eventId);
        if (existingIdx >= 0) {
          session.messages[existingIdx] = newMsg;
        } else {
          session.messages.push(newMsg);
          if (session.messages.length > 100) session.messages.shift();
        }

        if (cosmosHealthState.configured) {
          upsertFinalizedThoughtDocument({
            eventId,
            sessionId: activeSessionId,
            speakerId: "speaker-api",
            speakerName: "Speaker",
            sequenceNumber: 1,
            originalText: text.trim(),
            sourceLang: sourceLangCode,
            translations: { [targetLangCode]: { text: transResult.text, provider: transResult.provider, degraded: transResult.degraded } },
            degraded: transResult.degraded
          }).catch(err => console.warn("[CosmosDB] /api/translate write notice:", err));
        }
      }

      res.json({
        translatedText: transResult.text,
        eventId,
        executionTimeMs,
        provider: transResult.provider,
        translation_degraded: transResult.degraded
      });
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      console.error("[BHARATBRIDGE][TRANSLATION_RESPONSE] Server Translation error:", error);
      observabilityService.recordEvent({
        eventId,
        sessionId: "global",
        sourceLanguage: sourceLanguage || "en",
        targetLanguage: targetLanguage || "hi",
        stage: "TRANSLATION",
        eventType: "TRANSLATION_FAILURE",
        status: "FAILURE",
        provider: "untranslated",
        latencyMs: executionTimeMs,
        errorCode: "TRANSLATION_FAILURE",
        errorMessage: error.message || "Translation error"
      });
      res.status(503).json({
        error: error.message || "Translation error",
        fallback: true,
        translatedText: text,
        eventId,
        executionTimeMs,
        provider: "untranslated",
        translation_degraded: true
      });
    }
  });


  // Global Express error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Express Global Error Middleware]:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error"
    });
  });

  // WebSocket handling with origin check allowlist
  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    const envOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map(o => o.trim())
      .filter(Boolean);

    const allowedOrigins = Array.from(new Set([
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
      ...envOrigins
    ]));

    if (origin) {
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      const isPrivateNetwork = process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);

      const isAllowed = allowedOrigins.includes(origin) || isLocalhost || isPrivateNetwork;

      if (!isAllowed) {
        console.warn(`[WebSocket Upgrade] Rejected connection from unauthorized origin: ${origin}`);
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // Server-side WebSocket heartbeat cleanup (30s interval)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client: any) => {
      if (client.isAlive === false) return client.terminate();
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  // Inactive session TTL cleanup interval (purges sessions inactive > SESSION_TTL_MINUTES, default 10m)
  const sessionCleanupInterval = setInterval(() => {
    const now = Date.now();
    const ttlMinutes = Number(process.env.SESSION_TTL_MINUTES) || 10;
    const ttlMs = ttlMinutes * 60 * 1000;

    for (const [id, session] of sessions.entries()) {
      const activeListeners = Array.from(session.languageGroups.values()).reduce((sum, g) => sum + g.listeners.size, 0);
      const hasActiveSockets = (session.speaker && session.speaker.readyState === WebSocket.OPEN) ||
        (session.organizerWs && session.organizerWs.readyState === WebSocket.OPEN) ||
        activeListeners > 0;

      if (!hasActiveSockets && (now - session.lastActivity) > ttlMs) {
        console.log(`[SESSION_CLEANUP] Purging inactive session '${id}' (inactive for ${Math.round((now - session.lastActivity) / 1000)}s, TTL=${ttlMinutes}m)`);
        observabilityService.recordSessionEnd(id);
        session.languageGroups.forEach(g => {
          if (g.geminiSession) {
            try { g.geminiSession.close(); } catch (e) {}
          }
        });
        sessions.delete(id);
      }
    }
  }, 60000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
    clearInterval(sessionCleanupInterval);
  });

  const failedJoinMapByIp = new Map<string, { count: number; resetTime: number }>();

  function getWsClientIp(req: http.IncomingMessage): string {
    const trustHops = process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || 1 : 1;
    const xff = req.headers["x-forwarded-for"];
    if (xff && typeof xff === "string") {
      const parts = xff.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        const idx = Math.max(0, parts.length - trustHops);
        return parts[idx];
      }
    }
    return req.socket?.remoteAddress || "global";
  }

  const failedJoinMapBySession = new Map<string, { count: number; resetTime: number }>();
  let globalFailedJoins = { count: 0, resetTime: Date.now() + 60000 };

  async function applyFailedJoinThrottling(ip: string, sessionId?: string, token?: string): Promise<boolean> {
    const now = Date.now();
    if (now > globalFailedJoins.resetTime) {
      globalFailedJoins = { count: 0, resetTime: now + 60000 };
    }
    if (globalFailedJoins.count >= 100) {
      return false;
    }

    if (sessionId) {
      const sessRecord = failedJoinMapBySession.get(sessionId);
      if (sessRecord && now <= sessRecord.resetTime && sessRecord.count >= 30) {
        return false;
      }
    }

    // Exemption: If the client already possesses a valid sessionToken or hostToken for THIS session, exempt from IP throttling
    if (sessionId && token && sessions.has(sessionId)) {
      const existingSession = sessions.get(sessionId)!;
      if (!existingSession.ended) {
        const isSessionTokenValid = existingSession.sessionTokens && existingSession.sessionTokens.get(token) && existingSession.sessionTokens.get(token)! > now;
        const isHostTokenValid = (existingSession.hostToken && timingSafeEqualToken(token, existingSession.hostToken)) ||
          (existingSession.hostTokenHash && timingSafeEqualToken(crypto.createHash("sha256").update(token).digest("hex"), existingSession.hostTokenHash));
        if (isSessionTokenValid || isHostTokenValid) {
          return true;
        }
      }
    }

    const ipRecord = failedJoinMapByIp.get(ip);
    if (!ipRecord || now > ipRecord.resetTime) return true;

    const maxIpAttempts = process.env.MAX_FAILED_JOINS_PER_IP ? Number(process.env.MAX_FAILED_JOINS_PER_IP) : 30;
    if (ipRecord.count >= maxIpAttempts) {
      return false;
    }

    const threshold = process.env.FAILED_JOIN_THRESHOLD ? Number(process.env.FAILED_JOIN_THRESHOLD) : 10;
    if (ipRecord.count >= threshold) {
      const backoffMs = Math.min(3000, 100 * Math.pow(2, Math.min(5, ipRecord.count - threshold)));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
    return true;
  }

  function recordFailedJoinAttempt(ip: string, sessionId?: string): void {
    const now = Date.now();
    if (now > globalFailedJoins.resetTime) {
      globalFailedJoins = { count: 1, resetTime: now + 60000 };
    } else {
      globalFailedJoins.count++;
    }

    if (sessionId) {
      const sessRecord = failedJoinMapBySession.get(sessionId);
      if (!sessRecord || now > sessRecord.resetTime) {
        failedJoinMapBySession.set(sessionId, { count: 1, resetTime: now + 60000 });
      } else {
        sessRecord.count++;
      }
    }

    const ipRecord = failedJoinMapByIp.get(ip);
    if (!ipRecord || now > ipRecord.resetTime) {
      failedJoinMapByIp.set(ip, { count: 1, resetTime: now + 60 * 1000 });
    } else {
      ipRecord.count++;
    }
  }

  wss.on("connection", (ws, req) => {
    (ws as any).isAlive = true;
    (ws as any).remoteAddress = getWsClientIp(req);
    ws.on("pong", () => {
      (ws as any).isAlive = true;
    });

    ws.on("error", (error) => {
      console.error("[WebSocket Socket Error]:", error);
    });

    let currentSessionId: string | null = null;
    let currentRole: 'speaker' | 'listener' | null = null;
    let currentLang: string | null = null;

    ws.on("message", async (data) => {
      let message: any;
      try {
        message = JSON.parse(data.toString());
      } catch (parseErr) {
        console.warn("[WebSocket] Received malformed JSON payload:", data.toString().slice(0, 100));
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "error",
            code: "INVALID_JSON",
            message: "Malformed JSON payload"
          }));
        }
        return;
      }

      if (message.type === "ping") {
        (ws as any).isAlive = true;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
        return;
      }

      if (message.type === "end_session") {
        const targetSid = message.sessionId || currentSessionId;
        if (targetSid && sessions.has(targetSid)) {
          const session = sessions.get(targetSid)!;
          const hostTokenInput = message.token || message.hostToken;
          const isHost = session.organizerWs === ws || session.speaker === ws || (hostTokenInput && session.hostToken && timingSafeEqualToken(hostTokenInput, session.hostToken));
          if (isHost) {
            session.ended = true;
            session.sessionTokens?.clear();
            session.sessionToken = null;
            session.hostToken = null;
            session.hostTokenHash = null;
            const endPayload = JSON.stringify({ type: "session_ended", sessionId: targetSid });
            session.languageGroups.forEach(g => {
              g.listeners.forEach(l => {
                if (l.readyState === WebSocket.OPEN) l.send(endPayload);
              });
            });
            console.log(`[SESSION_ENDED] Session '${targetSid}' ended by host.`);
          } else {
            console.warn(`[SECURITY] Unauthorized end_session attempt by non-host socket on session '${targetSid}'.`);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "error",
                code: "FORBIDDEN",
                message: "Only the session host can end the session."
              }));
            }
          }
        }
        return;
      }

      if (message.type === "join" || message.type === "join_session") {
        const { sessionId, role, gender, targetLang } = message;
        const inputHostToken = message.hostToken || message.token;
        const clientIp = ((ws as any).remoteAddress || "global").toString().trim();

        // Throttling check before any Cosmos DB read
        const allowed = await applyFailedJoinThrottling(clientIp, sessionId, inputHostToken);
        if (!allowed) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "error",
              code: "RATE_LIMITED",
              message: "Too many failed join attempts. Please slow down."
            }));
            ws.close();
          }
          return;
        }

        currentSessionId = sessionId;
        currentLang = targetLang || "hi";

        let session = sessions.get(sessionId);
        if (!session && cosmosHealthState.configured) {
          try {
            const loaded = await loadSessionFromCosmos(sessionId);
            if (loaded && loaded.sessionDoc && loaded.sessionDoc.status !== "ended") {
              const { sessionDoc, messages } = loaded;
              session = {
                speaker: null,
                organizerWs: null,
                organizerId: null,
                hostTokenHash: sessionDoc?.hostTokenHash,
                sessionToken: sessionDoc?.sessionToken,
                sessionTokens: new Map<string, number>([
                  [sessionDoc?.sessionToken || crypto.randomBytes(32).toString("hex"), Date.now() + 24 * 3600 * 1000]
                ]),
                panelists: new Map(),
                pendingRequests: new Map(),
                languageGroups: new Map(),
                speakerGender: gender || "male",
                topic: sessionDoc?.topic || message.topic || message.glossary || "",
                isDuoMode: sessionDoc?.isDuoMode ?? false,
                messages: messages || [],
                lastActivity: Date.now()
              };
              sessions.set(sessionId, session);
              console.log(`[CosmosDB] Hydrated session '${sessionId}' from Cosmos DB with ${messages.length} messages.`);
            }
          } catch (cosmosLoadErr) {
            console.warn(`[CosmosDB] Failed to load session '${sessionId}' from Cosmos DB:`, cosmosLoadErr);
          }
        }

        // Reject unknown or ended sessionId
        if (!session || session.ended) {
          recordFailedJoinAttempt(clientIp, sessionId);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "error",
              code: "SESSION_NOT_FOUND",
              message: "Invalid session PIN. Session does not exist."
            }));
            ws.close();
          }
          return;
        }

        const isNewSession = false;

        session.lastActivity = Date.now();
        if (message.topic || message.glossary) {
          session.topic = message.topic || message.glossary;
        }
        console.log(`[DIAGNOSTIC][STEP1_JOIN] sessionId='${sessionId}' role='${role}' isNewSession=${isNewSession} isDuoMode=${session!.isDuoMode} targetLang='${targetLang}'`);

        if (role === "speaker" || role === "organizer") {
          const isExistingHostSocket = session!.organizerWs === ws || session!.speaker === ws;
          const isBrandNewHost = !session!.hostToken && !session!.hostTokenHash;

          let hasValidHostToken = false;
          if (inputHostToken) {
            if (session!.hostTokenHash) {
              const inputHash = crypto.createHash("sha256").update(inputHostToken).digest("hex");
              const bufInput = Buffer.from(inputHash, "hex");
              const bufStored = Buffer.from(session!.hostTokenHash, "hex");
              if (bufInput.length > 0 && bufInput.length === bufStored.length) {
                hasValidHostToken = crypto.timingSafeEqual(bufInput, bufStored);
              }
            } else if (session!.hostToken) {
              const bufInput = Buffer.from(inputHostToken, "utf8");
              const bufStored = Buffer.from(session!.hostToken, "utf8");
              if (bufInput.length > 0 && bufInput.length === bufStored.length) {
                hasValidHostToken = crypto.timingSafeEqual(bufInput, bufStored);
              }
            }
          }

          const canClaimHost = isExistingHostSocket || isBrandNewHost || hasValidHostToken;

          if (canClaimHost) {
            if (message.isDuoMode !== undefined) {
              session!.isDuoMode = message.isDuoMode === true || message.mode === 'duo';
            }
            if (isBrandNewHost) {
              const generatedHostToken = inputHostToken || crypto.randomBytes(16).toString("hex");
              session!.hostToken = generatedHostToken;
              session!.hostTokenHash = crypto.createHash("sha256").update(generatedHostToken).digest("hex");
              if (cosmosHealthState.configured) {
                upsertSessionDocument({
                  sessionId,
                  topic: message.topic || session!.topic || "",
                  isDuoMode: message.isDuoMode === true || message.mode === "duo" || session!.isDuoMode,
                  hostToken: generatedHostToken
                }).catch(err => console.warn("[CosmosDB] Session write error:", err));
              }
            }

            if (!session!.hostToken && inputHostToken) {
              session!.hostToken = inputHostToken;
            }

            session!.speaker = ws;
            session!.organizerWs = ws;
            session!.organizerId = message.userId || session!.organizerId;
            session!.speakerGender = gender || "male";
            currentRole = role;
            (ws as any).currentRole = role;

            if (!session!.panelists.has("speaker-01")) {
              session!.panelists.set("speaker-01", {
                speakerId: "speaker-01",
                userId: message.userId || "host",
                userName: message.userName || "Host Speaker",
                ws
              });
            }
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "host_token",
                sessionId,
                hostToken: session!.hostToken,
                role: "organizer"
              }));
            }
            const group = getOrCreateLanguageGroup(sessionId, currentLang!, session!.speakerGender);
            if (group) {
              group.listeners.add(ws);
            }
          } else {
            console.warn(`[SECURITY][SESSION_TAKEOVER_PREVENTED] Unauthorized host join attempt for session '${sessionId}' without valid hostToken.`);
            currentRole = "listener";
            (ws as any).currentRole = "listener";
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "role_changed",
                role: "LISTENER",
                status: "takeover_prevented",
                message: "Session host is already active. Valid host token required to join as organizer."
              }));
            }
            const group = getOrCreateLanguageGroup(sessionId, currentLang!, session!.speakerGender);
            if (group) {
              group.listeners.add(ws);
            }
          }
        } else {
          currentRole = "listener";
          (ws as any).currentRole = "listener";

          if (!session.sessionTokens) session.sessionTokens = new Map<string, number>();
          const mintedToken = crypto.randomBytes(32).toString("hex");
          session.sessionTokens.set(mintedToken, Date.now() + 24 * 3600 * 1000);
          session.sessionToken = mintedToken;

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "join_ack",
              sessionId,
              sessionToken: mintedToken,
              role: "listener"
            }));
          }

          // Cleanly remove listener from any previous language groups when switching target language
          session.languageGroups.forEach(g => {
            g.listeners.delete(ws);
          });
          const group = getOrCreateLanguageGroup(sessionId, currentLang!, session.speakerGender);
          if (group) {
            group.listeners.add(ws);
            console.log(`[DIAGNOSTIC][STEP1_LISTENER_REGISTERED] sessionId='${sessionId}' rawTargetLang='${targetLang}' canonicalCode='${getCanonicalLanguageCode(currentLang!)}' listenersCount=${group.listeners.size}`);
          }

          // Instantly send full message history (translated into listener's target language) over WebSocket
          if (session.messages && session.messages.length > 0) {
            (async () => {
              try {
                const historyPayloads = await Promise.all(
                  session.messages.map(async (m: SessionMessage) => {
                    if (!m.translations) m.translations = {};
                    let translatedText = m.translations[currentLang!];
                    let provider = m.provider || "cosmos";
                    let degraded = m.degraded || false;

                    if (typeof translatedText === "object") {
                      const tObj = translatedText as any;
                      translatedText = tObj.text;
                      if (tObj.degraded) degraded = true;
                      if (tObj.provider) provider = tObj.provider === "gemini" ? "cosmos" : tObj.provider;
                    }

                    if (!translatedText && m.targetLang === currentLang && m.translatedText) {
                      translatedText = m.translatedText;
                      m.translations[currentLang!] = translatedText;
                    }

                    if (!translatedText) {
                      const transResult = await generateTranslationWithGemini(
                        m.originalText,
                        m.originalText,
                        currentLang!,
                        m.sourceLang || "en"
                      );
                      translatedText = transResult.text;
                      provider = transResult.provider;
                      degraded = transResult.degraded;
                      if (!transResult.degraded && transResult.provider !== "untranslated") {
                        m.translations[currentLang!] = translatedText;
                      }
                    }

                    return {
                      originalText: m.originalText,
                      translatedText,
                      sourceLang: m.sourceLang || "en",
                      targetLang: currentLang,
                      timestamp: m.timestamp,
                      eventId: m.eventId || (m as any).id,
                      speakerId: m.speakerId || "speaker-01",
                      speakerName: m.speakerName || "Speaker",
                      provider,
                      translation_degraded: degraded
                    };
                  })
                );

                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: "history",
                    sessionId,
                    topic: session.topic || "",
                    name: session.topic || `Live Session #${sessionId}`,
                    sourceLang: "en",
                    messages: historyPayloads
                  }));
                }
              } catch (histErr) {
                console.error("[BHARATBRIDGE] Error generating history payload:", histErr);
              }
            })();
          }
        }

        // Broadcast stats & room_state
        const totalListeners = Array.from(session.languageGroups.values()).reduce((acc, g) => acc + g.listeners.size, 0);
        const statsPayload = JSON.stringify({ type: "stats", listeners: totalListeners });
        if (session.speaker?.readyState === WebSocket.OPEN) session.speaker.send(statsPayload);
        session.languageGroups.forEach(g => {
          g.listeners.forEach(l => {
            if (l.readyState === WebSocket.OPEN) l.send(statsPayload);
          });
        });
        broadcastRoomState(session);
      }

      if (message.type === "speaker_request" && currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) {
          const userId = message.userId || `user_${Date.now()}`;
          const userName = message.userName || "Listener";

          const existingPanelist = Array.from(session.panelists.values()).find(p => p.userId === userId);
          if (existingPanelist) {
            ws.send(JSON.stringify({
              type: "role_changed",
              role: "PANELIST",
              speakerId: existingPanelist.speakerId,
              speakerName: existingPanelist.userName,
              status: "approved"
            }));
            return;
          }

          if (session.panelists.size >= 10) {
            ws.send(JSON.stringify({
              type: "role_changed",
              role: "LISTENER",
              status: "limit_reached",
              message: "All 10 panelist positions are occupied"
            }));
            return;
          }

          // Auto-approve request ONLY for 1-on-1 duo mode sessions (max 2 speakers: 1 host + 1 guest)
          const shouldAutoApprove = session.isDuoMode === true && session.panelists.size < 2;
          if (shouldAutoApprove) {
            let assignedSlot = "";
            for (let i = 1; i <= 10; i++) {
              const candidateSlot = `speaker-${i < 10 ? '0' + i : i}`;
              if (!session.panelists.has(candidateSlot)) {
                assignedSlot = candidateSlot;
                break;
              }
            }
            if (assignedSlot) {
              (ws as any).currentRole = "speaker";
              session.panelists.set(assignedSlot, {
                speakerId: assignedSlot,
                userId,
                userName,
                ws
              });
              ws.send(JSON.stringify({
                type: "role_changed",
                role: "PANELIST",
                speakerId: assignedSlot,
                speakerName: userName,
                status: "approved"
              }));
              broadcastRoomState(session);
              return;
            }
          }

          session.pendingRequests.set(userId, {
            userId,
            userName,
            ws,
            requestedAt: Date.now(),
            targetLang: message.targetLang
          });

          ws.send(JSON.stringify({
            type: "speaker_request_status",
            status: "pending"
          }));

          broadcastRoomState(session);
        }
      }

      if (message.type === "speaker_approval" && currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) {
          if (ws !== session.organizerWs) {
            console.warn(`[SECURITY][SPEAKER_APPROVAL] Rejected unauthorized approval from non-organizer socket in session '${currentSessionId}'`);
            ws.send(JSON.stringify({
              type: "error",
              code: "UNAUTHORIZED",
              message: "Only the session organizer can approve speaker requests"
            }));
            return;
          }
          const { targetUserId, approved } = message;
          const reqItem = session.pendingRequests.get(targetUserId);

          if (reqItem) {
            session.pendingRequests.delete(targetUserId);

            if (!approved) {
              if (reqItem.ws.readyState === WebSocket.OPEN) {
                reqItem.ws.send(JSON.stringify({
                  type: "role_changed",
                  role: "LISTENER",
                  status: "rejected",
                  message: "Speaker request rejected by organizer"
                }));
              }
            } else {
              if (session.panelists.size >= 10) {
                if (reqItem.ws.readyState === WebSocket.OPEN) {
                  reqItem.ws.send(JSON.stringify({
                    type: "role_changed",
                    role: "LISTENER",
                    status: "limit_reached",
                    message: "All 10 panelist positions are occupied"
                  }));
                }
              } else {
                let assignedSlot = "";
                for (let i = 1; i <= 10; i++) {
                  const candidateSlot = `speaker-${i < 10 ? '0' + i : i}`;
                  if (!session.panelists.has(candidateSlot)) {
                    assignedSlot = candidateSlot;
                    break;
                  }
                }
                if (assignedSlot) {
                  (reqItem.ws as any).currentRole = "speaker";
                  session.panelists.set(assignedSlot, {
                    speakerId: assignedSlot,
                    userId: targetUserId,
                    userName: reqItem.userName,
                    ws: reqItem.ws
                  });
                  if (reqItem.ws.readyState === WebSocket.OPEN) {
                    reqItem.ws.send(JSON.stringify({
                      type: "role_changed",
                      role: "PANELIST",
                      speakerId: assignedSlot,
                      speakerName: reqItem.userName,
                      status: "approved"
                    }));
                  }
                }
              }
            }
            broadcastRoomState(session);
          }
        }
      }

      if (message.type === "switch_to_listener" && currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) {
          for (const [slot, panelist] of session.panelists.entries()) {
            if (panelist.ws === ws) {
              session.panelists.delete(slot);
              break;
            }
          }
          currentRole = "listener";
          (ws as any).currentRole = "listener";
          ws.send(JSON.stringify({
            type: "role_changed",
            role: "LISTENER",
            status: "switched"
          }));
          broadcastRoomState(session);
        }
      }

      if (message.type === "audio" && currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) {
          session.lastActivity = Date.now();
          const socketRole = (ws as any).currentRole || currentRole;
          const isAuthorized = Array.from(session.panelists.values()).some(p => p.ws === ws) || socketRole === "speaker" || socketRole === "organizer" || socketRole === "PANELIST" || socketRole === "panelist";
          if (isAuthorized) {
            // Pipe audio frame to ALL active language sessions with structured logging & error protection
            session.languageGroups.forEach((group, lang) => {
              if (group.geminiSession) {
                try {
                  console.log(`[GEMINI_LIVE][AUDIO_FRAME] Piping audio frame (${(message.audio || '').length} base64 chars) to group '${lang}'`);
                  group.geminiSession.sendRealtimeInput({
                    audio: { data: message.audio, mimeType: "audio/pcm;rate=16000" }
                  });
                } catch (audioErr: any) {
                  console.error(`[GEMINI_LIVE][AUDIO_FRAME_ERROR] Error piping audio frame to group '${lang}':`, audioErr);
                }
              }
            });
          }
        }
      }

      if (message.type === "speech_event" && currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (!session) {
          ws.send(JSON.stringify({ type: "error", code: "INVALID_SESSION", message: "Session not found" }));
          return;
        }

        const panelist = Array.from(session.panelists.values()).find(p => p.ws === ws);
        const socketRole = (ws as any).currentRole || currentRole;
        const isAuthorizedSpeaker = !!panelist || socketRole === "speaker" || socketRole === "organizer" || socketRole === "PANELIST" || socketRole === "panelist";

        if (!isAuthorizedSpeaker) {
          console.warn(`[BHARATBRIDGE][SPEECH_EVENT] REJECTED speech_event from unauthorized socket role: ${socketRole}`);
          ws.send(JSON.stringify({
            type: "error",
            code: "UNAUTHORIZED",
            message: "Unauthorized: Only active speakers or panelists can send speech events"
          }));
          return;
        }

        const { eventId, sourceText, sourceLanguage, sequenceNumber } = message;

        if (!sourceText || !sourceText.trim()) {
          console.warn(`[BHARATBRIDGE][SPEECH_EVENT] Rejected empty sourceText in eventId ${eventId}`);
          ws.send(JSON.stringify({ type: "error", code: "INVALID_PAYLOAD", message: "sourceText cannot be empty" }));
          return;
        }

        const speakerId = message.speakerId || panelist?.speakerId || "speaker-01";
        const speakerName = message.speakerName || panelist?.userName || "Speaker";

        // Monotonic Sequence Validation per (sessionId + speakerId)
        const lastSeq = getLastSequenceNumber(currentSessionId, speakerId);
        if (typeof sequenceNumber === "number" && sequenceNumber < lastSeq) {
          console.warn(`[BHARATBRIDGE][SPEECH_EVENT] Out-of-order sequence number received for speaker '${speakerId}': ${sequenceNumber} (last expected >= ${lastSeq})`);
          ws.send(JSON.stringify({
            type: "error",
            code: "OUT_OF_ORDER_SEQUENCE",
            message: `Out of order sequence number ${sequenceNumber} for speaker ${speakerId}. Last sequence was ${lastSeq}`
          }));
          return;
        }

        if (typeof sequenceNumber === "number") {
          setLastSequenceNumber(currentSessionId, speakerId, sequenceNumber);
        }

        const activeLanguages = getActiveLanguages(currentSessionId);

        // Step 4: Register event, discover active languages, log structured telemetry
        console.log(`[BHARATBRIDGE][SPEECH_EVENT_RECEIVED] eventId='${eventId}' speaker='${speakerId}' (${speakerName}) sourceLang='${sourceLanguage || 'en'}' seq=${sequenceNumber || 'none'}`);
        console.log(`[BHARATBRIDGE][ACTIVE_LANGUAGES] sessionId='${currentSessionId}' count=${activeLanguages.length} activeLanguages=[${activeLanguages.join(', ')}]`);

        // Acknowledge receipt to speaker socket with active language list
        ws.send(JSON.stringify({
          type: "speech_event_ack",
          eventId,
          sessionId: currentSessionId,
          sequenceNumber: sequenceNumber || lastSeq,
          activeLanguages,
          status: "ACCEPTED"
        }));

        // Send speaker original transcript payload over WS
        const speakerPayload = JSON.stringify({
          type: "transcription",
          eventId,
          originalText: sourceText.trim(),
          translatedText: "",
          sourceLang: sourceLanguage || "en",
          targetLang: sourceLanguage || "en",
          isFinal: true,
          speakerId,
          speakerName,
          sequenceNumber: sequenceNumber || lastSeq
        });
        if (session.speaker && session.speaker.readyState === WebSocket.OPEN) {
          session.speaker.send(speakerPayload);
        }

        // Contextual Thought Buffer Ingestion & Boundary Evaluation (Session + Speaker Keyed)
        const now = Date.now();
        const bufferKey = `${currentSessionId}:${speakerId}`;
        let buffer = activeThoughtBuffers.get(bufferKey);

        if (!buffer) {
          buffer = {
            sessionId: currentSessionId,
            speakerId,
            speakerName,
            fragments: [],
            sourceLanguage: sourceLanguage || "en",
            firstSequenceNumber: sequenceNumber || lastSeq,
            latestSequenceNumber: sequenceNumber || lastSeq,
            firstEventId: eventId,
            latestEventId: eventId,
            createdTimestamp: now,
            lastFragmentTimestamp: now,
            flushTimer: null
          };
          activeThoughtBuffers.set(bufferKey, buffer);
        }

        // Reset existing flush timer
        if (buffer.flushTimer) {
          clearTimeout(buffer.flushTimer);
          buffer.flushTimer = null;
        }

        // Append fragment
        const cleanFragment = sourceText.trim();
        buffer.fragments.push(cleanFragment);
        buffer.latestSequenceNumber = sequenceNumber || lastSeq;
        buffer.latestEventId = eventId;
        buffer.lastFragmentTimestamp = now;

        // Boundary Heuristic Evaluations (Env Configurable)
        const combinedText = buffer.fragments.join(" ").trim();
        const totalWords = combinedText.split(/\s+/).filter(Boolean).length;
        const hasTerminalPunctuation = /[.?!।]$/.test(cleanFragment);
        const maxDurationMs = Number(process.env.MAX_THOUGHT_DURATION_MS) || 2500;
        const maxDurationExceeded = (now - buffer.createdTimestamp) >= maxDurationMs;
        const wordCountFlushLimit = Number(process.env.WORD_COUNT_FLUSH_LIMIT) || 9999;
        const wordCountExceeded = totalWords >= wordCountFlushLimit;

        const shouldFlushImmediately = hasTerminalPunctuation || wordCountExceeded || maxDurationExceeded;
        const inactivityMs = Number(process.env.INACTIVITY_FLUSH_MS) || 1500;

        console.log(`[BHARATBRIDGE][THOUGHT_BUFFER_ADD] session='${currentSessionId}' speaker='${speakerId}' fragments=${buffer.fragments.length} words=${totalWords} terminalPunct=${hasTerminalPunctuation} wordExceeded=${wordCountExceeded} -> flushImmediate=${shouldFlushImmediately}`);

        if (shouldFlushImmediately) {
          flushThoughtBuffer(currentSessionId, speakerId);
        } else {
          // Set inactivity flush timer
          buffer.flushTimer = setTimeout(() => {
            flushThoughtBuffer(currentSessionId, speakerId);
          }, inactivityMs);
        }
      }

      if (message.type === "text_translation") {
        console.log(`[BHARATBRIDGE][WS_RECEIVE] Server received text_translation frame. currentRole='${currentRole}', socketRole='${(ws as any).currentRole}', currentSessionId='${currentSessionId}'`);
      }

      if (message.type === "text_translation" && currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) {
          const eventId = message.eventId || generateEventId();
          const panelist = Array.from(session.panelists.values()).find(p => p.ws === ws);
          const socketRole = (ws as any).currentRole || currentRole;
          const isAuthorizedSpeaker = !!panelist || socketRole === "speaker" || socketRole === "organizer" || socketRole === "PANELIST" || socketRole === "panelist";

          observabilityService.recordEvent({
            eventId,
            sessionId: currentSessionId,
            speakerId: panelist?.speakerId || message.speakerId || "speaker-01",
            sourceLanguage: message.sourceLang || "en",
            targetLanguage: message.targetLang || "hi",
            stage: "WEBSOCKET",
            eventType: "WS_SERVER_RECEIVE",
            status: "SUCCESS",
            latencyMs: "NOT_MEASURED"
          });

          if (!isAuthorizedSpeaker) {
            console.warn(`[BHARATBRIDGE][WS_RECEIVE] REJECTED text_translation from unauthorized socket. socketRole='${socketRole}'`);
            observabilityService.recordEvent({
              eventId,
              sessionId: currentSessionId,
              sourceLanguage: message.sourceLang || "en",
              targetLanguage: message.targetLang || "hi",
              stage: "WEBSOCKET",
              eventType: "WS_REJECTED",
              status: "REJECTED",
              errorCode: "WS_AUTH_REJECTED",
              errorMessage: `Unauthorized socketRole=${socketRole}`
            });
            return;
          }

          observabilityService.recordEvent({
            eventId,
            sessionId: currentSessionId,
            speakerId: panelist?.speakerId || message.speakerId || "speaker-01",
            sourceLanguage: message.sourceLang || "en",
            targetLanguage: message.targetLang || "hi",
            stage: "WEBSOCKET",
            eventType: "WS_AUTHORIZED",
            status: "SUCCESS"
          });

          console.log(`[BHARATBRIDGE][WS_RECEIVE] Server AUTHORIZED text_translation for speakerId='${panelist?.speakerId || "speaker-01"}' eventId='${eventId}'`);
          const { originalText, translatedText, sourceLang, targetLang } = message;
          const isFinal = message.isFinal !== false;
          const srcLangName = LANGUAGE_NAME_MAP[sourceLang] || sourceLang || "English";

          const speakerId = panelist?.speakerId || message.speakerId || "speaker-01";
          const speakerName = panelist?.userName || message.speakerName || "Speaker";

          if (isFinal && originalText && originalText.trim()) {
            const cleanText = originalText.trim().toLowerCase();
            const now = Date.now();
            const isDuplicate = (session.messages || []).some(
              m => (m.originalText || "").trim().toLowerCase() === cleanText && (now - m.timestamp < 4000)
            );
            if (!isDuplicate) {
              const newMsg = { originalText: originalText.trim(), translatedText: (translatedText || "").trim(), sourceLang, targetLang, timestamp: now, speakerId, speakerName, eventId };
              session.messages = [newMsg, ...(session.messages || [])].slice(0, 100);
            }
          }

          const speakerPayload = JSON.stringify({
            type: "transcription",
            eventId,
            originalText,
            translatedText: "", // Speaker only receives original transcript, never target translation
            sourceLang,
            targetLang: sourceLang,
            isFinal,
            speakerId,
            speakerName
          });
          if (session.speaker && session.speaker.readyState === WebSocket.OPEN) {
            session.speaker.send(speakerPayload);
          }

          // Broadcast to listeners across all target language groups
          console.log(`[DIAGNOSTIC][STEP2_BROADCAST_TEXT_TRANSLATION] currentSessionId='${currentSessionId}' messageTargetLang='${targetLang}' availableGroups=[${Array.from(session.languageGroups.keys()).join(', ')}]`);
          session.languageGroups.forEach((group, groupLang) => {
            console.log(`[DIAGNOSTIC][STEP2_GROUP_CHECK] groupLang='${groupLang}' messageTargetLang='${targetLang}' sourceLang='${sourceLang}' listenersCount=${group.listeners.size}`);
            if (group.listeners.size === 0) return;

            observabilityService.recordEvent({
              eventId,
              sessionId: currentSessionId,
              speakerId,
              sourceLanguage: sourceLang,
              targetLanguage: groupLang,
              stage: "WEBSOCKET",
              eventType: "LANGUAGE_GROUP_MATCH",
              status: "SUCCESS"
            });

            if (groupLang === sourceLang) {
              const listenerPayload = JSON.stringify({
                type: "transcription",
                eventId,
                originalText,
                translatedText: originalText,
                sourceLang,
                targetLang: groupLang,
                isFinal,
                speakerId,
                speakerName
              });

              group.listeners.forEach(l => {
                console.log(`[DIAGNOSTIC][STEP3_SOCKET_STATE_TEXT_TRANSLATION] groupLang='${groupLang}' listenerWs.readyState=${l.readyState} (OPEN=1)`);
                if (l.readyState === WebSocket.OPEN) l.send(listenerPayload);
              });
            } else {
              // Asynchronous background translation for listeners in each active target language group
              (async () => {
                let langTranslation = (translatedText && targetLang === groupLang) ? translatedText : "";
                let transProvider = "provided";
                let transDegraded = false;

                if (!langTranslation) {
                  try {
                    const recentContext = (session.messages || []).slice(0, 6).map(m => ({ originalText: m.originalText, translatedText: m.translatedText }));
                    const transRes = await generateTranslationWithGemini(originalText, originalText, groupLang, sourceLang, recentContext);
                    langTranslation = transRes.text;
                    transProvider = transRes.provider;
                    transDegraded = transRes.degraded;
                  } catch (e) {
                    langTranslation = originalText;
                    transProvider = "untranslated";
                    transDegraded = true;
                  }
                }

                const secondaryPayload = JSON.stringify({
                  type: "transcription",
                  eventId,
                  originalText,
                  translatedText: langTranslation,
                  sourceLang,
                  targetLang: groupLang,
                  isFinal,
                  speakerId,
                  speakerName,
                  provider: transProvider,
                  translation_degraded: transDegraded
                });

                group.listeners.forEach(l => {
                  console.log(`[DIAGNOSTIC][STEP3_SOCKET_STATE_TEXT_TRANSLATION] groupLang='${groupLang}' listenerWs.readyState=${l.readyState} (OPEN=1)`);
                  if (l.readyState === WebSocket.OPEN) l.send(secondaryPayload);
                });

                observabilityService.recordEvent({
                  eventId,
                  sessionId: currentSessionId,
                  speakerId,
                  sourceLanguage: sourceLang,
                  targetLanguage: groupLang,
                  stage: "WEBSOCKET",
                  eventType: "WS_BROADCAST",
                  status: "SUCCESS"
                });
              })();
            }
          });
        }
      }
    });

    ws.on("close", () => {
      if (currentSessionId && sessions.has(currentSessionId)) {
        const session = sessions.get(currentSessionId)!;
        const socketRole = (ws as any).currentRole || currentRole;

        if (socketRole === "speaker" || socketRole === "organizer") {
          if (session.speaker === ws) session.speaker = null;
          if (session.organizerWs === ws) session.organizerWs = null;
        }

        // Remove panelist entry if this socket was a panelist
        for (const [slot, panelist] of session.panelists.entries()) {
          if (panelist.ws === ws) {
            session.panelists.delete(slot);
            console.log(`[CLOSE] Removed panelist slot '${slot}' for disconnected user '${panelist.userName}'`);
            break;
          }
        }

        if (currentLang) {
          const canonical = getCanonicalLanguageCode(currentLang);
          const group = session.languageGroups.get(canonical);
          if (group) {
            group.listeners.delete(ws);
            if (group.listeners.size === 0) {
              if (group.geminiSession) group.geminiSession.close();
              session.languageGroups.delete(canonical);
            }
          }
        }

        // Broadcast stats & room_state
        const totalListeners = Array.from(session.languageGroups.values()).reduce((acc, g) => acc + g.listeners.size, 0);
        const statsPayload = JSON.stringify({ type: "stats", listeners: totalListeners });
        if (session.speaker?.readyState === WebSocket.OPEN) session.speaker.send(statsPayload);
        session.languageGroups.forEach(g => {
          g.listeners.forEach(l => {
            if (l.readyState === WebSocket.OPEN) l.send(statsPayload);
          });
        });
        broadcastRoomState(session);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
        hmr: false,
        headers: { "Cross-Origin-Opener-Policy": "same-origin-allow-popups" }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, process.env.NODE_ENV === "production" ? "." : "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  try {
    const initRes = await initCosmosDB();
    if (initRes.success) {
      console.log(`[Persistence] Cosmos DB active — database: ${process.env.COSMOS_DB_DATABASE_NAME || "bharatbridge"}`);
    } else {
      console.log(`[Persistence] Cosmos DB credentials missing or invalid — persistence OFF: ${initRes.error}`);
    }
  } catch (cosmosInitErr: any) {
    console.error("[Persistence] Cosmos DB initialization failed:", cosmosInitErr?.message || cosmosInitErr);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
    console.log(`[AI_CONFIG] Effective translation model: ${process.env.GEMINI_MODEL_TRANSLATION || "gemini-3.8-flash"}`);
  });

  const handleShutdown = async (signal: string) => {
    console.log(`[SERVER_SHUTDOWN] Signal '${signal}' received. Flushing metrics to Cosmos DB (3s timeout)...`);
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
    await Promise.race([
      observabilityService.flushMetricsToCosmos().catch((err) => {
        console.warn("[SERVER_SHUTDOWN] Graceful metrics flush warning:", err?.message || err);
      }),
      timeoutPromise
    ]);
    process.exit(0);
  };

  process.once("SIGINT", () => handleShutdown("SIGINT"));
  process.once("SIGTERM", () => handleShutdown("SIGTERM"));
}

const isDirectExecution = Boolean(process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  process.argv[1].endsWith("server.ts") ||
  process.argv[1].endsWith("server.cjs") ||
  process.argv[1].endsWith("server.js")
));

if (isDirectExecution) {
  startServer().catch(err => {
    console.error("CRITICAL: Failed to start server:", err);
    process.exit(1);
  });
}
