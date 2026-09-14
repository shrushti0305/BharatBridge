import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

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

  // Azure Blob Storage Upload for Captions
  app.post("/api/azure/upload-caption", async (req, res) => {
    const { sessionId, sessionName, captions } = req.body;
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "bharat-bridge-captions";

    if (!connectionString) {
      // Graceful fallback when Azure keys are not yet added to .env
      return res.status(200).json({
        success: true,
        mock: true,
        message: "Azure Storage keys not set in .env. Captions logged locally.",
        blobName: `captions-${sessionId || 'session'}.json`,
        blobUrl: `local://storage/captions-${sessionId || 'session'}.json`
      });
    }

    try {
      // Dynamic import to avoid missing dependency failures
      const { BlobServiceClient } = await import("@azure/storage-blob" as any);
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists({ access: "container" });

      const blobName = `captions-${sessionId}-${Date.now()}.json`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const content = JSON.stringify({ sessionId, sessionName, createdAt: new Date().toISOString(), captions }, null, 2);

      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: { blobContentType: "application/json" }
      });

      res.json({
        success: true,
        blobName,
        blobUrl: blockBlobClient.url
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

  // Azure Neural Text-to-Speech (TTS) API Endpoint
  app.post("/api/azure/tts", async (req, res) => {
    const { text, languageCode, voiceName } = req.body;
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || "centralindia";

    if (!key) {
      return res.status(400).json({ error: "AZURE_SPEECH_KEY not configured in .env" });
    }

    try {
      const selectedVoice = voiceName || (languageCode === 'hi' ? 'hi-IN-SwaraNeural' : `${languageCode}-IN-Neural`);
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

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Azure TTS HTTP ${response.status}: ${errText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      res.json({ audio: base64Audio, format: "audio/mp3" });
    } catch (error: any) {
      console.error("Azure TTS Error:", error);
      res.status(500).json({ error: error.message || "Azure Neural TTS Failed" });
    }
  });


  // Room management
  type LanguageGroup = {
    geminiSession: any | null;
    listeners: Set<WebSocket>;
  };

  type SessionState = {
    speaker: WebSocket | null;
    languageGroups: Map<string, LanguageGroup>;
    speakerGender: string;
  };

  const sessions = new Map<string, SessionState>();

  // Helper to get or create a language group
  const getOrCreateLanguageGroup = async (sessionId: string, targetLang: string, gender: string): Promise<LanguageGroup | null> => {
    const session = sessions.get(sessionId);
    if (!session) return null;

    if (!session.languageGroups.has(targetLang)) {
      const voiceName = gender === 'female' ? 'Zephyr' : 'Fenrir';
      console.log(`Creating Gemini session for room ${sessionId} lang ${targetLang}`);
      
      try {
        const geminiSession = await ai.live.connect({
          model: "gemini-2.0-flash-exp",
          config: {
            systemInstruction: {
              parts: [{ text: `You are an expert real-time interpreter translating incoming spoken audio into ${targetLang}.` }]
            },
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName
                }
              }
            },
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            responseModalities: [Modality.AUDIO],
          },
          callbacks: {
            onmessage: (msg: LiveServerMessage) => {
              const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              const group = session.languageGroups.get(targetLang);
              if (!group) return;

              if (audio) {
                const payload = JSON.stringify({ type: "audio", audio, targetLang });
                group.listeners.forEach(l => {
                  if (l.readyState === WebSocket.OPEN) l.send(payload);
                });
              }

              const transcription = msg.serverContent?.modelTurn?.parts?.[0]?.text;
              if (transcription) {
                const payload = JSON.stringify({ 
                  type: "transcription", 
                  originalText: transcription,
                  translatedText: transcription,
                  targetLang,
                  isFinal: true
                });
                group.listeners.forEach(l => {
                  if (l.readyState === WebSocket.OPEN) l.send(payload);
                });
                if (session.speaker?.readyState === WebSocket.OPEN) session.speaker.send(payload);
              }

              if (msg.serverContent?.interrupted) {
                const payload = JSON.stringify({ type: "interrupted", targetLang });
                group.listeners.forEach(l => {
                  if (l.readyState === WebSocket.OPEN) l.send(payload);
                });
              }
            }
          }
        });
        session.languageGroups.set(targetLang, { geminiSession, listeners: new Set() });
      } catch (err) {
        console.error(`Gemini connection failed for ${targetLang}:`, err);
        session.languageGroups.set(targetLang, { geminiSession: null, listeners: new Set() });
      }
    }
    return session.languageGroups.get(targetLang)!;
  };

  // API Routes
  app.post("/api/translate", async (req, res) => {
    const { text, sourceLanguage, targetLanguage } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Missing text or targetLanguage" });
    try {
      const model = "gemini-2.5-flash";
      const prompt = `Translate the following text from ${sourceLanguage || "auto-detected language"} to ${targetLanguage}. Return ONLY the translated text, nothing else. Text: "${text}"`;
      const result = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.1 }
      });
      res.json({ translatedText: result.text.trim() });
    } catch (error: any) {
      console.error("Translation error:", error);
      // Fallback echo translation if offline or missing API key
      res.json({ translatedText: `[${targetLanguage}]: ${text}` });
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
            speakerGender: gender || "male"
          });
        }

        const session = sessions.get(sessionId)!;
        if (role === "speaker") {
          session.speaker = ws;
          session.speakerGender = gender || "male";
          // Create the speaker's preferred language group immediately for feedback
          await getOrCreateLanguageGroup(sessionId, currentLang!, session.speakerGender);
        } else {
          const group = await getOrCreateLanguageGroup(sessionId, currentLang!, session.speakerGender);
          if (group) {
            group.listeners.add(ws);
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
      server: { middlewareMode: true },
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
