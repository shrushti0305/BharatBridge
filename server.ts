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
    res.json({ status: "ok", mode: process.env.NODE_ENV || 'development' });
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
          model: "gemini-3.5-live-translate-preview",
          config: {
            translationConfig: {
              targetLanguageCode: targetLang,
              echoTargetLanguage: false
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
                // ONLY send back to speaker if it's their chosen language group
                // Note: speaker can optionally choose a lang to monitor
                // Here we assume the speaker gets the language group they specifically joined (currentLang)
                // This is a bit simplified, but let's check if the speaker is monitoring this lang
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
                // We'll send transcriptions to speaker so they can see all translations or just their primary
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
        return null;
      }
    }
    return session.languageGroups.get(targetLang)!;
  };

  // API Routes
  app.post("/api/translate", async (req, res) => {
    const { text, sourceLanguage, targetLanguage } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Missing text or targetLanguage" });
    try {
      const model = "gemini-3.6-flash";
      const prompt = `Translate the following text from ${sourceLanguage || "auto-detected language"} to ${targetLanguage}. Return ONLY the translated text, nothing else. Text: "${text}"`;
      const result = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.1 }
      });
      res.json({ translatedText: result.text.trim() });
    } catch (error: any) {
      console.error("Translation error:", error);
      res.status(500).json({ error: error.message });
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
