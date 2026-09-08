import { nanoid } from "nanoid";
import { db } from "./db.js";
import { verifyToken } from "./auth.js";
import { isValidLanguage } from "./languages.js";
import { translateSegment } from "./azureTranslate.js";
import { summarizeSession } from "./ai.js";

// sessionId -> Map(languageCode -> count of currently-connected sockets listening in it)
const activeLanguagesBySession = new Map();

function bumpLanguage(sessionId, language, delta) {
  if (!activeLanguagesBySession.has(sessionId)) activeLanguagesBySession.set(sessionId, new Map());
  const counts = activeLanguagesBySession.get(sessionId);
  const next = (counts.get(language) || 0) + delta;
  if (next <= 0) counts.delete(language);
  else counts.set(language, next);
}

function activeLanguageList(sessionId) {
  const counts = activeLanguagesBySession.get(sessionId);
  if (!counts) return [];
  return Array.from(counts.entries()).map(([language, listeners]) => ({ language, listeners }));
}

function broadcastRoster(io, sessionId) {
  io.to(allRoom(sessionId)).emit("roster:update", { languages: activeLanguageList(sessionId) });
}

function roomForLanguage(sessionId, lang) {
  return `session:${sessionId}:lang:${lang}`;
}
function speakerRoom(sessionId) {
  return `session:${sessionId}:speaker`;
}
function allRoom(sessionId) {
  return `session:${sessionId}:all`; // status/roster updates, everyone in the session
}

function nextSeq(sessionId) {
  const row = db
    .prepare("SELECT MAX(seq) AS m FROM transcript_segments WHERE session_id = ?")
    .get(sessionId);
  return (row?.m || 0) + 1;
}

export function registerRealtime(io) {
  io.use((socket, next) => {
    const user = verifyToken(socket.handshake.auth?.token);
    if (!user) return next(new Error("Unauthorized"));
    socket.user = user;
    next();
  });

  io.on("connection", (socket) => {
    // ---- SPEAKER: start broadcasting ----
    socket.on("speaker:join", ({ sessionId }, ack) => {
      const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
      if (!session) return ack?.({ error: "Session not found" });
      if (session.speaker_id !== socket.user.id) return ack?.({ error: "Not the speaker for this session" });
      if (session.status !== "live") return ack?.({ error: "Session has already ended" });

      socket.data.sessionId = sessionId;
      socket.data.role = "speaker";
      socket.join(speakerRoom(sessionId));
      socket.join(allRoom(sessionId));
      ack?.({ ok: true, session: toPublicSession(session), roster: activeLanguageList(sessionId) });
    });

    // A finalized chunk of speech from the speaker. Persist it, translate to every language
    // currently being listened to, persist those translations, then push to each language room.
    socket.on("speaker:segment", async ({ sessionId, text, isFinal = true }, ack) => {
      try {
        if (socket.data.role !== "speaker" || socket.data.sessionId !== sessionId) {
          return ack?.({ error: "Not authorized to send segments for this session" });
        }
        const text_ = (text || "").trim();
        if (!text_) return ack?.({ ok: true, skipped: true });

        const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
        if (!session || session.status !== "live") return ack?.({ error: "Session is not live" });

        const segmentId = nanoid();
        const seq = nextSeq(sessionId);
        db.prepare(
          `INSERT INTO transcript_segments (id, session_id, seq, source_text, is_final) VALUES (?, ?, ?, ?, ?)`
        ).run(segmentId, sessionId, seq, text_, isFinal ? 1 : 0);

        // Let anyone watching the raw transcript (e.g. speaker's own screen) see it immediately.
        io.to(speakerRoom(sessionId)).emit("transcript:segment", {
          segmentId,
          seq,
          sourceText: text_,
          isFinal,
        });

        const activeLangsFromMap = activeLanguageList(sessionId).map((l) => l.language);
        const dbLangs = db
          .prepare("SELECT DISTINCT language FROM session_participants WHERE session_id = ?")
          .all(sessionId)
          .map((r) => r.language);
        const allActiveLangs = Array.from(new Set([...activeLangsFromMap, ...dbLangs, "en"]));

        const targets = allActiveLangs.filter((l) => l && l !== session.speaker_language);

        ack?.({ ok: true, segmentId });

        // Always emit caption to speaker's own language room as well (for listeners listening in speaker language)
        io.to(roomForLanguage(sessionId, session.speaker_language)).emit("caption", {
          segmentId,
          seq,
          language: session.speaker_language,
          text: text_,
          sourceText: text_,
          isFinal,
        });

        if (targets.length > 0) {
          let translated;
          try {
            translated = await translateSegment({
              sourceText: text_,
              sourceLangCode: session.speaker_language,
              targetLangCodes: targets,
              sessionTitle: session.title,
            });
          } catch (err) {
            console.error("translateSegment failed, falling back to source text", err.message);
            translated = Object.fromEntries(targets.map((l) => [l, text_]));
          }

          const insert = db.prepare(
            `INSERT INTO translations (id, segment_id, session_id, language, translated_text) VALUES (?, ?, ?, ?, ?)`
          );
          for (const lang of targets) {
            const translatedText = translated[lang] || text_;
            try {
              insert.run(nanoid(), segmentId, sessionId, lang, translatedText);
            } catch (e) {
              // ignore duplicate key constraint if any
            }
            io.to(roomForLanguage(sessionId, lang)).emit("caption", {
              segmentId,
              seq,
              language: lang,
              text: translatedText,
              sourceText: text_,
              isFinal,
            });
          }
        }

        // Also broadcast directly to allRoom as safety fallback so listeners in all rooms receive captions
        io.to(allRoom(sessionId)).emit("caption:broadcast", {
          segmentId,
          seq,
          sourceText: text_,
          isFinal,
        });
      } catch (err) {
        console.error("speaker:segment error", err);
        ack?.({ error: "Server error processing segment" });
      }
    });

    // Real-time word-by-word interim broadcast for ultra-fast listener transcription
    socket.on("speaker:interim", ({ sessionId, text }) => {
      io.to(allRoom(sessionId)).emit("caption:interim", { text });
    });

    // ---- LISTENER: join and choose/change language ----
    socket.on("listener:join", ({ sessionId, language }, ack) => {
      const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
      if (!session) return ack?.({ error: "Session not found" });
      if (!isValidLanguage(language)) return ack?.({ error: "Invalid language" });
      if (session.status !== "live") return ack?.({ error: "This session has ended", ended: true });

      db.prepare(
        `INSERT INTO session_participants (id, session_id, user_id, language)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(session_id, user_id) DO UPDATE SET language = excluded.language`
      ).run(nanoid(), sessionId, socket.user.id, language);

      leavePreviousLanguageRoom(socket);
      socket.data.sessionId = sessionId;
      socket.data.role = "listener";
      socket.data.language = language;
      socket.join(roomForLanguage(sessionId, language));
      socket.join(allRoom(sessionId));

      bumpLanguage(sessionId, language, 1);
      broadcastRoster(io, sessionId);

      ack?.({ ok: true, session: toPublicSession(session), roster: activeLanguageList(sessionId) });
    });

    socket.on("listener:change-language", ({ language }, ack) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId || socket.data.role !== "listener") return ack?.({ error: "Not in a session" });
      if (!isValidLanguage(language)) return ack?.({ error: "Invalid language" });

      db.prepare(
        `UPDATE session_participants SET language = ? WHERE session_id = ? AND user_id = ?`
      ).run(language, sessionId, socket.user.id);

      const oldLanguage = socket.data.language;
      leavePreviousLanguageRoom(socket);
      socket.data.language = language;
      socket.join(roomForLanguage(sessionId, language));

      if (oldLanguage) bumpLanguage(sessionId, oldLanguage, -1);
      bumpLanguage(sessionId, language, 1);
      broadcastRoster(io, sessionId);

      ack?.({ ok: true });
    });

    // ---- LIVE Q&A: Submit, Upvote, and Fetch Questions ----
    socket.on("question:submit", async ({ sessionId, question }, ack) => {
      if (!question || typeof question !== "string" || !question.trim()) {
        return ack?.({ error: "Please enter a valid question." });
      }
      const qId = nanoid();
      const userName = socket.user?.name || "Audience Member";
      const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
      const listenerLang = socket.data.language || "auto";
      const speakerLang = session?.speaker_language || "en";

      let sourceLang = listenerLang === "hinglish" || listenerLang === "auto" ? "hi" : listenerLang;
      let targetLang = speakerLang === "hinglish" || speakerLang === "auto" ? "en" : speakerLang;

      let translatedQuestion = question.trim();
      if (targetLang && sourceLang !== targetLang) {
        try {
          const map = await translateSegment({
            sourceText: question.trim(),
            sourceLangCode: sourceLang,
            targetLangCodes: [targetLang],
          });
          translatedQuestion = map[targetLang] || question.trim();
        } catch (err) {
          console.error("Question translation failed:", err.message);
        }
      }

      db.prepare(
        "INSERT INTO session_questions (id, session_id, user_id, user_name, question, translated_question, upvotes) VALUES (?, ?, ?, ?, ?, ?, 1)"
      ).run(qId, sessionId, socket.user.id, userName, question.trim(), translatedQuestion);

      const newQ = {
        id: qId,
        sessionId,
        userId: socket.user.id,
        userName,
        question: question.trim(),
        translatedQuestion,
        upvotes: 1,
      };
      io.to(allRoom(sessionId)).emit("question:new", newQ);
      ack?.({ ok: true, question: newQ });
    });

    socket.on("question:upvote", ({ questionId, sessionId }, ack) => {
      db.prepare("UPDATE session_questions SET upvotes = upvotes + 1 WHERE id = ?").run(questionId);
      const row = db.prepare("SELECT * FROM session_questions WHERE id = ?").get(questionId);
      if (row) {
        io.to(allRoom(sessionId)).emit("question:updated", row);
      }
      ack?.({ ok: true, upvotes: row?.upvotes || 1 });
    });

    socket.on("question:list", ({ sessionId }, ack) => {
      const questions = db
        .prepare("SELECT * FROM session_questions WHERE session_id = ? ORDER BY upvotes DESC, created_at DESC")
        .all(sessionId);
      ack?.({ ok: true, questions });
    });

    // ---- SPEAKER: end session -> summarize + persist + notify everyone ----
    socket.on("speaker:end", async ({ sessionId }, ack) => {
      try {
        const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
        if (!session) return ack?.({ error: "Session not found" });
        if (session.speaker_id !== socket.user.id) return ack?.({ error: "Not the speaker" });
        if (session.status === "ended") return ack?.({ ok: true, alreadyEnded: true });

        db.prepare(`UPDATE sessions SET status = 'ended', ended_at = datetime('now') WHERE id = ?`).run(
          sessionId
        );
        io.to(allRoom(sessionId)).emit("session:ended", { sessionId });

        const segments = db
          .prepare("SELECT source_text FROM transcript_segments WHERE session_id = ? ORDER BY seq ASC")
          .all(sessionId);
        const fullTranscript = segments.map((s) => s.source_text).join(" ");

        ack?.({ ok: true, summarizing: true });

        let summary;
        try {
          summary = await summarizeSession({
            title: session.title,
            sourceLangCode: session.speaker_language,
            fullTranscript,
          });
        } catch (err) {
          console.error("summarizeSession failed", err.message);
          summary =
            "We weren't able to generate written notes for this session automatically. The full transcript below is still saved.";
        }
        db.prepare(`UPDATE sessions SET summary = ? WHERE id = ?`).run(summary, sessionId);

        const activeCounts = activeLanguagesBySession.get(sessionId);
        const activeLangs = activeCounts ? Array.from(activeCounts.keys()) : [];
        let translations = {};
        if (activeLangs.length > 0 && summary && !summary.includes("We weren't able")) {
          try {
            translations = await translateSegment({
              sourceText: summary,
              sourceLangCode: "en",
              targetLangCodes: activeLangs,
            });
          } catch (err) {
            console.error("Auto summary translation for listeners failed:", err.message);
          }
        }

        io.to(allRoom(sessionId)).emit("session:summary-ready", { sessionId, summary, translations });

        activeLanguagesBySession.delete(sessionId);
      } catch (err) {
        console.error("speaker:end error", err);
        ack?.({ error: "Server error ending session" });
      }
    });

    socket.on("speaker:audio-upload", ({ sessionId, audioUrl }) => {
      io.to(allRoom(sessionId)).emit("session:audio-available", { sessionId, audioUrl });
    });

    // WebRTC Signaling Relay for direct live speaker audio streaming
    socket.on("webrtc:signal", ({ targetSocketId, type, sdp, candidate }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:signal", {
          senderSocketId: socket.id,
          type,
          sdp,
          candidate,
        });
      }
    });

    socket.on("disconnect", () => {
      // If a listener disconnects, remove their language from the active count so translation
      // effort and the speaker's roster view accurately reflect who's actually still listening.
      if (socket.data.role === "listener" && socket.data.sessionId && socket.data.language) {
        bumpLanguage(socket.data.sessionId, socket.data.language, -1);
        broadcastRoster(io, socket.data.sessionId);
      }
    });
  });
}

function leavePreviousLanguageRoom(socket) {
  const { sessionId, language } = socket.data;
  if (sessionId && language) socket.leave(roomForLanguage(sessionId, language));
}

function toPublicSession(row) {
  return {
    id: row.id,
    joinCode: row.join_code,
    title: row.title,
    speakerId: row.speaker_id,
    speakerLanguage: row.speaker_language,
    status: row.status,
    audioUrl: row.audio_url || null,
  };
}