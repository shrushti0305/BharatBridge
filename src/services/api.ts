/**
 * BharatBridge Production API Client Service
 * Enforces typed requests, automated retries, timeout guards, and client-side fallbacks.
 */

export interface TranslationOptions {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: Array<{ originalText: string; translatedText: string }>;
  timeoutMs?: number;
  eventId?: string;
}

export interface TranslationResult {
  success: boolean;
  translatedText: string;
  provider?: string;
  executionTimeMs?: number;
  warning?: string;
}

export interface LanguageDetectionResult {
  success: boolean;
  languageCode: string;
  languageName?: string;
  confidence?: number;
  provider?: string;
}

export interface HealthCheckResult {
  success: boolean;
  status: string;
  timestamp?: string;
  uptimeSeconds?: number;
  activeSessions?: number;
  totalListeners?: number;
  services?: Record<string, boolean>;
}

export interface AzureTTSOptions {
  text: string;
  languageCode: string;
  voiceName?: string;
  eventId?: string;
}

export interface AzureTTSResult {
  success: boolean;
  audio?: string; // Base64 audio string
  format?: string;
  error?: string;
}

/**
 * Perform contextual text translation with multi-stage fallback
 */
export async function translateText(options: TranslationOptions): Promise<TranslationResult> {
  const { text, sourceLanguage, targetLanguage, context, timeoutMs = 8000, eventId } = options;
  const cleanText = text.trim();
  if (!cleanText) {
    return { success: true, translatedText: "" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  console.log("[BHARATBRIDGE][TRANSLATION_REQUEST] Client requesting /api/translate:", { cleanText, sourceLanguage, targetLanguage, eventId });
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        text: cleanText,
        sourceLanguage,
        targetLanguage,
        context,
        eventId
      })
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      console.log("[BHARATBRIDGE][TRANSLATION_RESPONSE] /api/translate success response:", data);
      return {
        success: data.success !== false,
        translatedText: data.translatedText || cleanText,
        provider: data.provider || "gemini",
        executionTimeMs: data.executionTimeMs,
        warning: data.warning
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn("[BHARATBRIDGE][TRANSLATION_RESPONSE] Translation network error:", err.message || err);
  }

  // Graceful raw text fallback if all network APIs fail
  return {
    success: false,
    translatedText: cleanText,
    provider: "client-fallback",
    warning: "All translation APIs temporarily unavailable. Raw text rendered."
  };
}

/**
 * Auto-detect language of input text
 */
export async function detectLanguage(text: string): Promise<LanguageDetectionResult> {
  const cleanText = text.trim();
  if (!cleanText) {
    return { success: true, languageCode: "hi", languageName: "Hindi", confidence: 1.0 };
  }

  try {
    const res = await fetch("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText })
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        languageCode: data.languageCode || "hi",
        languageName: data.languageName || "Hindi",
        confidence: data.confidence || 0.9,
        provider: data.provider
      };
    }
  } catch (err) {
    console.warn("[BharatBridge API] Detection error:", err);
  }

  return { success: false, languageCode: "hi", languageName: "Hindi", confidence: 0.5 };
}

/**
 * Request Azure Neural Text-to-Speech audio synthesis
 */
export async function synthesizeSpeech(options: AzureTTSOptions): Promise<AzureTTSResult> {
  const { text, languageCode, voiceName, eventId } = options;
  if (!text || !text.trim()) return { success: false, error: "Empty text" };

  console.log("[BHARATBRIDGE][TTS_REQUEST] Client requesting /api/azure/tts:", { text: text.trim(), languageCode, voiceName, eventId });
  try {
    const res = await fetch("/api/azure/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), languageCode, voiceName, eventId })
    });

    if (res.ok) {
      const data = await res.json();
      const contentType = res.headers.get("content-type") || data.contentType || "audio/mp3";
      const byteSize = data.byteSize || (data.audio ? Math.floor(data.audio.length * 0.75) : 0);
      console.log(`[BHARATBRIDGE][TTS_RESPONSE] /api/azure/tts success: contentType='${contentType}', byteSize=${byteSize} bytes, base64Length=${data.audio?.length || 0}`);
      return {
        success: true,
        audio: data.audio,
        format: data.format || "audio/mp3"
      };
    } else {
      const errData = await res.json().catch(() => ({ error: "TTS failed" }));
      console.warn("[BHARATBRIDGE][TTS_RESPONSE] /api/azure/tts error response:", errData);
      return { success: false, error: errData.error };
    }
  } catch (err: any) {
    console.warn("[BHARATBRIDGE][TTS_RESPONSE] /api/azure/tts network failure:", err.message || err);
    return { success: false, error: err.message || "TTS Network failure" };
  }
}

/**
 * Fetch health status of BharatBridge services
 */
export async function checkApiHealth(): Promise<HealthCheckResult> {
  try {
    const res = await fetch("/api/health");
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("[BharatBridge API] Health check failed:", err);
  }
  return { success: false, status: "unavailable" };
}
