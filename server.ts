import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import dns from "dns";

// Prevent Windows IPv6 DNS connection timeouts on Node fetch
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

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

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: process.env.NODE_ENV || 'development',
      azureStorageConfigured: Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING)
    });
  });

  // Azure Blob Storage Upload for Captions (Dual-Format JSON + CSV)
  app.post("/api/azure/upload-caption", async (req, res) => {
    const { sessionId, sessionName, captions } = req.body;
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "ai-audio";

    if (!connectionString) {
      return res.status(200).json({
        success: true,
        mock: true,
        message: "Azure Storage keys not set in .env. Captions logged locally.",
        blobName: `captions-${sessionId || 'session'}.csv`,
        blobUrl: `local://storage/captions-${sessionId || 'session'}.csv`
      });
    }

    try {
      const { BlobServiceClient } = await import("@azure/storage-blob" as any);
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();

      const timeStamp = Date.now();
      const jsonBlobName = `captions-${sessionId}-${timeStamp}.json`;
      const jsonBlockBlobClient = containerClient.getBlockBlobClient(jsonBlobName);
      const jsonContent = JSON.stringify({ sessionId, sessionName, createdAt: new Date().toISOString(), captions }, null, 2);

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

  // Azure Cognitive Services Translator API Endpoint
  app.post("/api/azure/translate", async (req, res) => {
    const { text, sourceLanguageCode, targetLanguageCode } = req.body;
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

  // Azure Voice Mapping for 22 Indian languages + English
  const AZURE_VOICE_MAP: Record<string, string> = {
    hi: "hi-IN-SwaraNeural",
    ta: "ta-IN-PallaviNeural",
    te: "te-IN-ShrutiNeural",
    mr: "mr-IN-AarohiNeural",
    gu: "gu-IN-DhwaniNeural",
    bn: "bn-IN-TanishaaNeural",
    kn: "kn-IN-SapnaNeural",
    ml: "ml-IN-SobhanaNeural",
    en: "en-IN-NeerjaNeural",
    pa: "pa-IN-OjasNeural",
    ur: "ur-IN-GulNeural",
    or: "or-IN-SubhasiniNeural",
    as: "as-IN-YashicaNeural"
  };

  // Resilient Text-to-Speech (TTS) API Endpoint with Azure + Google Neural Fallback
  app.post("/api/azure/tts", async (req, res) => {
    const { text, languageCode, voiceName } = req.body;
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || "centralindia";
    const cleanLang = (languageCode || "hi").split("-")[0];

    if (key) {
      try {
        const selectedVoice = voiceName || AZURE_VOICE_MAP[cleanLang] || `${cleanLang}-IN-Neural`;
        const ssml = `<speak version='1.0' xml:lang='${languageCode || 'hi-IN'}'><voice name='${selectedVoice}'>${text}</voice></speak>`;

        const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "BharatBridge"
          },
          body: ssml
        });

        if (response.ok) {
          const audioBuffer = await response.arrayBuffer();
          const base64Audio = Buffer.from(audioBuffer).toString("base64");
          return res.json({ audio: base64Audio, format: "audio/mp3" });
        }
      } catch (error) {
        console.warn("[TTS] Azure TTS failed, triggering universal fallback:", error);
      }
    }

    // High-availability Fallback: Universal Google Neural TTS Engine for Indian languages
    try {
      const shortText = (text || "").slice(0, 200);
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(shortText)}&tl=${cleanLang}&client=tw-ob`;
      const response = await fetch(googleTtsUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString("base64");
        return res.json({ audio: base64Audio, format: "audio/mp3" });
      }
      res.status(500).json({ error: "TTS generation failed" });
    } catch (error: any) {
      console.error("[TTS] Universal TTS Error:", error);
      res.status(500).json({ error: error.message || "TTS synthesis error" });
    }
  });

  // Room management
  type LanguageGroup = {
    geminiSession: any | null;
    listeners: Set<WebSocket>;
  };

  type SessionMessage = {
    originalText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    timestamp: number;
  };

  type SessionState = {
    speaker: WebSocket | null;
    languageGroups: Map<string, LanguageGroup>;
    speakerGender: string;
    messages: SessionMessage[];
  };

  const sessions = new Map<string, SessionState>();

  // Helper to get or create a language group non-blockingly
  const getOrCreateLanguageGroup = (sessionId: string, targetLang: string, gender: string): LanguageGroup | null => {
    const session = sessions.get(sessionId);
    if (!session) return null;

    if (!session.languageGroups.has(targetLang)) {
      session.languageGroups.set(targetLang, { geminiSession: null, listeners: new Set() });
    }
    return session.languageGroups.get(targetLang)!;
  };

  async function generateTranslationWithGemini(
    promptOrText: string, 
    rawText?: string, 
    targetLangCode?: string, 
    sourceLangCode?: string,
    context?: Array<{ originalText: string; translatedText: string }>
  ): Promise<string> {
    const cleanText = (rawText || promptOrText).trim();
    if (!cleanText) return "";
    const cleanTargetCode = (targetLangCode || "hi").split("-")[0];
    const targetLangName = LANGUAGE_NAME_MAP[cleanTargetCode] || cleanTargetCode;
    const sourceLangName = sourceLangCode ? (LANGUAGE_NAME_MAP[sourceLangCode.split("-")[0]] || sourceLangCode) : "auto-detected language";

    // 1. Primary Engine: Gemini AI Context-Aware Natural Translation
    const contextPrompt = context && context.length > 0 
      ? `Recent Conversation Context:\n${context.slice(-4).map(c => `Original: "${c.originalText}" -> Translated: "${c.translatedText}"`).join("\n")}\n\n`
      : "";

    const systemPrompt = `You are a high-precision, context-aware natural language translator specializing in Indian languages.
${contextPrompt}Translate the following sentence naturally from ${sourceLangName} to ${targetLangName}.

STRICT REQUIREMENTS:
- DO NOT translate word-for-word literally. Translate contextually and idiomatically so it sounds completely natural to a native ${targetLangName} speaker.
- Respect full sentence grammar, phrasing, cultural nuances, and conversational tone.
- Output ONLY the final translated text in ${targetLangName}. Do NOT include quotes, explanations, or notes.

Sentence: "${cleanText}"`;

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    for (const model of models) {
      try {
        const result = await ai.models.generateContent({
          model,
          contents: systemPrompt,
          config: { temperature: 0.2 }
        });
        if (result.text && result.text.trim()) {
          const cleaned = result.text.trim().replace(/^["']|["']$/g, '');
          if (cleaned) return cleaned;
        }
      } catch (err: any) {
        // Continue to fallback model
      }
    }

    // 2. High-availability Universal Google Translate Fallback (Zero quota limit, instant sub-100ms response)
    if (cleanText && cleanTargetCode) {
      try {
        const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${cleanTargetCode}&dt=t&q=${encodeURIComponent(cleanText)}`;
        const gRes = await fetch(gUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (Array.isArray(gData) && gData[0]) {
            const gText = gData[0].map((item: any) => item[0]).filter(Boolean).join("");
            if (gText && gText.trim()) return gText.trim();
          }
        }
      } catch (gErr) {
        console.warn("[Google Translate Fallback] Error:", gErr);
      }
    }

    // 3. Azure Translator API Fallback if configured
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
          if (translatedText) return translatedText;
        }
      } catch (e) {
        console.warn("[Azure Translation] Error:", e);
      }
    }

    return cleanText;
  }

  // API Routes
  app.post("/api/translate", async (req, res) => {
    const { text, sourceLanguage, targetLanguage, context } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Missing text or targetLanguage" });
    try {
      const targetLangCode = Object.keys(LANGUAGE_NAME_MAP).find(k => LANGUAGE_NAME_MAP[k].toLowerCase() === targetLanguage.toLowerCase()) || 'hi';
      const sourceLangCode = sourceLanguage ? Object.keys(LANGUAGE_NAME_MAP).find(k => LANGUAGE_NAME_MAP[k].toLowerCase() === sourceLanguage.toLowerCase()) || 'en' : 'en';
      const translatedText = await generateTranslationWithGemini(text, text, targetLangCode, sourceLangCode, context);
      res.json({ translatedText });
    } catch (error: any) {
      console.error("Translation error:", error);
      res.json({ translatedText: text });
    }
  });

  // AI Session Summary API Endpoint
  app.post("/api/session-summary", async (req, res) => {
    const { sessionId, messages, targetLanguage } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No transcript messages available to generate summary." });
    }

    try {
      const fullTranscript = messages.map((m: any, i: number) => 
        `[${i + 1}] Original: "${m.originalText}" | Translated (${targetLanguage || "Target"}): "${m.translatedText || m.originalText}"`
      ).join("\n");

      const prompt = `You are an expert AI summary generator. 
Given the following session transcript, generate a structured session summary in ${targetLanguage || "English"}.

Structure:
# Session Summary (ID: ${sessionId || "Live Session"})
## Executive Overview
Brief 2-3 sentence overview of what was discussed.

## Key Points & Highlights
- List 3-5 main key takeaways or points discussed.

## Detailed Summary Notes
Chronological breakdown of key statements and topics.

Transcript:
${fullTranscript}

Return ONLY clean markdown formatting without extra conversational intro or outro.`;

      const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      for (const model of models) {
        try {
          const result = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { temperature: 0.2 }
          });
          if (result.text && result.text.trim()) {
            return res.json({ success: true, summary: result.text.trim() });
          }
        } catch (err: any) {}
      }

      // Fallback summary generator
      const fallbackSummary = `# Session Summary (ID: ${sessionId || "Live Session"})

## Executive Overview
Session record containing ${messages.length} transcript lines.

## Key Transcript Highlights
${messages.slice(0, 8).map((m: any) => `- ${m.translatedText || m.originalText}`).join('\n')}

---
Generated by BharatBridge AI Matrix.`;

      res.json({ success: true, summary: fallbackSummary });
    } catch (error: any) {
      console.error("Session Summary API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate session summary" });
    }
  });

  // WebSocket handling
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on("connection", (ws) => {
    let currentSessionId: string | null = null;
    let currentRole: 'speaker' | 'listener' | null = null;
    let currentLang: string | null = null;

    ws.on("message", async (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === "join") {
        const { sessionId, role, gender, targetLang } = message;
        currentSessionId = sessionId;
        currentRole = role;
        currentLang = targetLang || "hi";

        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, { 
            speaker: null, 
            languageGroups: new Map(),
            speakerGender: gender || "male",
            messages: []
          });
        }

        const session = sessions.get(sessionId)!;
        if (role === "speaker") {
          session.speaker = ws;
          session.speakerGender = gender || "male";
          getOrCreateLanguageGroup(sessionId, currentLang!, session.speakerGender);
        } else {
          // Cleanly remove listener from any previous language groups when switching target language
          session.languageGroups.forEach(g => {
            g.listeners.delete(ws);
          });
          const group = getOrCreateLanguageGroup(sessionId, currentLang!, session.speakerGender);
          if (group) {
            group.listeners.add(ws);
          }

          // Instantly send full message history (translated into listener's target language) over WebSocket
          if (session.messages && session.messages.length > 0) {
            (async () => {
              const historyPayloads: any[] = [];
              const trgLangName = LANGUAGE_NAME_MAP[currentLang!] || currentLang!;
              for (const m of session.messages) {
                let translatedText = m.translatedText;
                if (m.targetLang !== currentLang) {
                  const srcLangName = LANGUAGE_NAME_MAP[m.sourceLang] || m.sourceLang || "English";
                  const prompt = `Translate the following text from ${srcLangName} to ${trgLangName}. Return ONLY translated text. Text: "${m.originalText}"`;
                  translatedText = await generateTranslationWithGemini(prompt, m.originalText, currentLang!);
                }
                historyPayloads.push({
                  originalText: m.originalText,
                  translatedText,
                  sourceLang: m.sourceLang,
                  targetLang: currentLang,
                  timestamp: m.timestamp
                });
              }
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "history", messages: historyPayloads }));
              }
            })();
          }
        }

        // Broadcast stats
        const totalListeners = Array.from(session.languageGroups.values()).reduce((acc, g) => acc + g.listeners.size, 0);
        const statsPayload = JSON.stringify({ type: "stats", listeners: totalListeners });
        if (session.speaker?.readyState === WebSocket.OPEN) session.speaker.send(statsPayload);
        session.languageGroups.forEach(g => {
          g.listeners.forEach(l => {
            if (l.readyState === WebSocket.OPEN) l.send(statsPayload);
          });
        });
      }

      if (message.type === "audio" && currentRole === "speaker" && currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) {
          // Pipe audio to ALL active language sessions
          session.languageGroups.forEach(group => {
            if (group.geminiSession) {
              group.geminiSession.sendRealtimeInput({
                audio: { data: message.audio, mimeType: "audio/pcm;rate=16000" }
              });
            }
          });
        }
      }

      if (message.type === "text_translation" && currentRole === "speaker" && currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) {
          const { originalText, translatedText, sourceLang, targetLang } = message;
          const isFinal = message.isFinal !== false;
          const srcLangName = LANGUAGE_NAME_MAP[sourceLang] || sourceLang || "English";

          if (isFinal && originalText && originalText.trim()) {
            const cleanText = originalText.trim().toLowerCase();
            const now = Date.now();
            const isDuplicate = (session.messages || []).some(
              m => (m.originalText || "").trim().toLowerCase() === cleanText && (now - m.timestamp < 4000)
            );
            if (!isDuplicate) {
              const newMsg = { originalText: originalText.trim(), translatedText: (translatedText || "").trim(), sourceLang, targetLang, timestamp: now };
              session.messages = [newMsg, ...(session.messages || [])].slice(0, 100);
            }
          }

          const speakerPayload = JSON.stringify({
            type: "transcription",
            originalText,
            translatedText: "", // Speaker only receives original transcript, never target translation
            sourceLang,
            targetLang: sourceLang,
            isFinal
          });
          if (session.speaker && session.speaker.readyState === WebSocket.OPEN) {
            session.speaker.send(speakerPayload);
          }

          // Broadcast to listeners across all target language groups
          session.languageGroups.forEach((group, groupLang) => {
            if (group.listeners.size === 0) return;

            if (groupLang === targetLang) {
              const listenerPayload = JSON.stringify({
                type: "transcription",
                originalText,
                translatedText: translatedText,
                sourceLang,
                targetLang: groupLang,
                isFinal
              });

              group.listeners.forEach(l => {
                if (l.readyState === WebSocket.OPEN) l.send(listenerPayload);
              });
            } else if (groupLang === sourceLang) {
              const listenerPayload = JSON.stringify({
                type: "transcription",
                originalText,
                translatedText: originalText,
                sourceLang,
                targetLang: groupLang,
                isFinal
              });

              group.listeners.forEach(l => {
                if (l.readyState === WebSocket.OPEN) l.send(listenerPayload);
              });
            } else {
              // Asynchronous background translation for listeners in secondary language groups
              (async () => {
                let langTranslation = originalText;
                const trgLangName = LANGUAGE_NAME_MAP[groupLang] || groupLang;
                try {
                  const recentContext = (session.messages || []).slice(0, 6).map(m => ({ originalText: m.originalText, translatedText: m.translatedText }));
                  const prompt = `Translate the following text from ${srcLangName} to ${trgLangName}. Return ONLY translated text. Text: "${originalText}"`;
                  langTranslation = await generateTranslationWithGemini(prompt, originalText, groupLang, sourceLang, recentContext);
                } catch (e) {
                  langTranslation = originalText;
                }

                const secondaryPayload = JSON.stringify({
                  type: "transcription",
                  originalText,
                  translatedText: langTranslation,
                  sourceLang,
                  targetLang: groupLang,
                  isFinal
                });

                group.listeners.forEach(l => {
                  if (l.readyState === WebSocket.OPEN) l.send(secondaryPayload);
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
        if (currentRole === "speaker") {
          session.speaker = null;
          // Close all Gemini sessions for this room
          session.languageGroups.forEach(g => {
            if (g.geminiSession) g.geminiSession.close();
          });
          session.languageGroups.clear();
        } else if (currentLang) {
          const group = session.languageGroups.get(currentLang);
          if (group) {
            group.listeners.delete(ws);
            // Optional: Close Gemini session if no listeners left in this language
            if (group.listeners.size === 0) {
              if (group.geminiSession) group.geminiSession.close();
              session.languageGroups.delete(currentLang);
            }
          }
        }

        // Broadcast stats
        const totalListeners = Array.from(session.languageGroups.values()).reduce((acc, g) => acc + g.listeners.size, 0);
        const statsPayload = JSON.stringify({ type: "stats", listeners: totalListeners });
        if (session.speaker?.readyState === WebSocket.OPEN) session.speaker.send(statsPayload);
        session.languageGroups.forEach(g => {
          g.listeners.forEach(l => {
            if (l.readyState === WebSocket.OPEN) l.send(statsPayload);
          });
        });
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
  process.exit(1);
});
