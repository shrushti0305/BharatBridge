import fs from "fs";
import path from "path";
import express from "express";
import rateLimit from "express-rate-limit";
import { nanoid, customAlphabet } from "nanoid";
import { db } from "./db.js";
import { requireAuth } from "./auth.js";
import { isValidLanguage, LANGUAGES, SPEAKER_LANGUAGES } from "./languages.js";
import { isValidTitle, isValidJoinCode } from "./validation.js";
import { summarizeSession } from "./ai.js";
import { translateSegment } from "./azureTranslate.js";

const makeJoinCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export const sessionsRouter = express.Router();

// Session creation triggers real API usage (translation + summary costs) — cap how many a
// single account can spin up in a short window so a bug or bad actor can't run up your bill.
const createSessionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sessions created recently. Please wait before starting another." },
});

sessionsRouter.get("/languages", (req, res) => {
  res.json({ languages: LANGUAGES, speakerLanguages: SPEAKER_LANGUAGES });
});

// Speaker creates a new live session.
sessionsRouter.post("/", requireAuth, createSessionLimiter, (req, res) => {
  const { title, speakerLanguage } = req.body || {};
  if (!isValidTitle(title)) {
    return res.status(400).json({ error: "Please enter a session title (1-200 characters)." });
  }
  if (!isValidLanguage(speakerLanguage)) {
    return res.status(400).json({ error: "Please choose a valid speaking language." });
  }
  const id = nanoid();
  let join_code;
  do {
    join_code = makeJoinCode();
  } while (db.prepare("SELECT 1 FROM sessions WHERE join_code = ?").get(join_code));

  db.prepare(
    `INSERT INTO sessions (id, join_code, title, speaker_id, speaker_language, status)
     VALUES (?, ?, ?, ?, ?, 'live')`
  ).run(id, join_code, title.trim(), req.user.id, speakerLanguage);

  res.json(getSessionRow(id));
});

// Listener looks up a session by its short join code before connecting the socket.
// Guards against someone scripting through possible join codes to find live sessions.
const lookupCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many lookups. Please wait a few minutes and try again." },
});

sessionsRouter.get("/by-code/:code", requireAuth, lookupCodeLimiter, (req, res) => {
  if (!isValidJoinCode(req.params.code)) {
    return res.status(400).json({ error: "That doesn't look like a valid join code." });
  }
  const row = db
    .prepare("SELECT * FROM sessions WHERE join_code = ?")
    .get(req.params.code.toUpperCase().trim());
  if (!row) return res.status(404).json({ error: "No session found for that code" });
  res.json(publicSession(row));
});

// A user's own history: sessions they spoke at, plus sessions they listened to.
sessionsRouter.get("/mine", requireAuth, (req, res) => {
  const spoken = db
    .prepare(
      `SELECT * FROM sessions WHERE speaker_id = ? ORDER BY created_at DESC`
    )
    .all(req.user.id)
    .map((r) => ({ ...publicSession(r), role: "speaker" }));

  const listened = db
    .prepare(
      `SELECT s.*, sp.language AS my_language
       FROM session_participants sp
       JOIN sessions s ON s.id = sp.session_id
       WHERE sp.user_id = ?
       ORDER BY sp.joined_at DESC`
    )
    .all(req.user.id)
    .map((r) => ({ ...publicSession(r), role: "listener", myLanguage: r.my_language }));

  res.json({ spoken, listened });
});

// Full detail for one session: metadata + transcript + (if listener) their language's translation.
sessionsRouter.get("/:id", requireAuth, async (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Session not found" });

  const isSpeaker = row.speaker_id === req.user.id;
  const participant = db
    .prepare("SELECT * FROM session_participants WHERE session_id = ? AND user_id = ?")
    .get(row.id, req.user.id);

  if (!isSpeaker && !participant) {
    return res.status(403).json({ error: "You don't have access to this session's transcript" });
  }

  const segments = db
    .prepare("SELECT * FROM transcript_segments WHERE session_id = ? ORDER BY seq ASC")
    .all(row.id);

  const listenerLang = participant?.language;
  let translationsBySegment = {};
  if (listenerLang) {
    const rows = db
      .prepare(
        `SELECT segment_id, translated_text FROM translations WHERE session_id = ? AND language = ?`
      )
      .all(row.id, listenerLang);
    translationsBySegment = Object.fromEntries(rows.map((r) => [r.segment_id, r.translated_text]));

    // Auto-translate any past segments missing translation in listener's preferred language
    const missingSegments = segments.filter((s) => !translationsBySegment[s.id]);
    if (missingSegments.length > 0) {
      for (const s of missingSegments) {
        try {
          const map = await translateSegment({
            sourceText: s.source_text,
            sourceLangCode: row.speaker_language,
            targetLangCodes: [listenerLang],
          });
          const translated = map[listenerLang] || s.source_text;
          db.prepare(
            `INSERT INTO translations (id, segment_id, session_id, language, translated_text)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(segment_id, language) DO UPDATE SET translated_text = excluded.translated_text`
          ).run(nanoid(), s.id, row.id, listenerLang, translated);
          translationsBySegment[s.id] = translated;
        } catch (err) {
          translationsBySegment[s.id] = s.source_text;
        }
      }
    }
  }

  const transcript = segments.map((s) => ({
    id: s.id,
    seq: s.seq,
    sourceText: s.source_text,
    translatedText: listenerLang ? translationsBySegment[s.id] || s.source_text : null,
    createdAt: s.created_at,
  }));

  let summary = row.summary;
  const targetLang = req.query.lang || listenerLang;
  if (summary && targetLang && targetLang !== "en" && !summary.includes("We weren't able")) {
    try {
      const map = await translateSegment({
        sourceText: summary,
        sourceLangCode: "en",
        targetLangCodes: [targetLang],
      });
      summary = map[targetLang] || summary;
    } catch (e) {
      console.error("Summary translation failed:", e.message);
    }
  }

  res.json({
    session: { ...publicSession(row), summary },
    role: isSpeaker ? "speaker" : "listener",
    myLanguage: listenerLang || row.speaker_language,
    transcript,
  });
});

// Re-generate or generate summary on demand for any existing session.
sessionsRouter.post("/:id/summarize", requireAuth, async (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Session not found" });

  const segments = db
    .prepare("SELECT source_text FROM transcript_segments WHERE session_id = ? ORDER BY seq ASC")
    .all(row.id);
  const fullTranscript = segments.map((s) => s.source_text).join(" ");

  let summary = await summarizeSession({
    title: row.title,
    sourceLangCode: row.speaker_language,
    fullTranscript,
  });

  db.prepare("UPDATE sessions SET summary = ? WHERE id = ?").run(summary, row.id);

  const targetLang = req.query.lang;
  if (summary && targetLang && targetLang !== "en" && !summary.includes("We weren't able")) {
    try {
      const map = await translateSegment({
        sourceText: summary,
        sourceLangCode: "en",
        targetLangCodes: [targetLang],
      });
      summary = map[targetLang] || summary;
    } catch (e) {
      console.error("On-demand summary translation failed:", e.message);
    }
  }

  res.json({ ok: true, summary });
});

// Export Session Transcript as Subtitles (.srt, .vtt), TXT, or JSON for video players and LMS integration
sessionsRouter.get("/:id/export", async (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Session not found" });

  const format = (req.query.format || "txt").toLowerCase();
  const lang = req.query.lang || row.speaker_language;

  const segments = db.prepare("SELECT * FROM transcript_segments WHERE session_id = ? ORDER BY seq ASC").all(row.id);

  let translationsBySegment = {};
  if (lang && lang !== row.speaker_language) {
    const rows = db.prepare("SELECT segment_id, translated_text FROM translations WHERE session_id = ? AND language = ?").all(row.id, lang);
    translationsBySegment = Object.fromEntries(rows.map((r) => [r.segment_id, r.translated_text]));
  }

  const items = segments.map((s, idx) => ({
    seq: s.seq,
    sourceText: s.source_text,
    text: translationsBySegment[s.id] || s.source_text,
    createdAt: s.created_at,
  }));

  if (format === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="transcript-${row.id}.json"`);
    return res.json({ session: { id: row.id, title: row.title, lang }, items });
  }

  if (format === "srt" || format === "vtt") {
    const isVtt = format === "vtt";
    const lines = [];
    if (isVtt) lines.push("WEBVTT\n");

    const startTime = new Date(row.created_at).getTime();
    items.forEach((item, idx) => {
      const segTime = new Date(item.createdAt).getTime();
      const startMs = Math.max(0, segTime - startTime);
      const endMs = startMs + 4000; // 4s subtitle block duration

      const formatTime = (ms) => {
        const s = Math.floor(ms / 1000) % 60;
        const m = Math.floor(ms / (1000 * 60)) % 60;
        const h = Math.floor(ms / (1000 * 60 * 60));
        const msRem = ms % 1000;
        const sep = isVtt ? "." : ",";
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(msRem).padStart(3, "0")}`;
      };

      lines.push(`${idx + 1}`);
      lines.push(`${formatTime(startMs)} --> ${formatTime(endMs)}`);
      if (item.sourceText && item.sourceText !== item.text) {
        lines.push(`🎙️ ${item.sourceText}`);
        lines.push(`🌐 ${item.text}\n`);
      } else {
        lines.push(`${item.text}\n`);
      }
    });

    const ext = isVtt ? "vtt" : "srt";
    res.setHeader("Content-Type", isVtt ? "text/vtt" : "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="subtitles-${row.id}.${ext}"`);
    return res.send(lines.join("\n"));
  }

  // Plain Text export default
  const createdDate = new Date(row.created_at).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  const txtLines = [
    `==================================================`,
    `  BHARATBRIDGE SESSION TRANSCRIPT EXPORT`,
    `  Session Title    : ${row.title}`,
    `  Session Code     : ${row.join_code || row.id}`,
    `  Date & Time      : ${createdDate}`,
    `  Speaker Language : ${row.speaker_language}`,
    `  Target Language  : ${lang}`,
    `==================================================\n`,
    ...items.map((item, idx) => {
      if (item.sourceText && item.sourceText !== item.text) {
        return `[Line ${idx + 1}]\n🎙️ Speaker (Original): ${item.sourceText}\n🌐 Translation (${lang}): ${item.text}\n`;
      }
      return `[Line ${idx + 1}]\n🎙️ Speaker (Original): ${item.sourceText || item.text}\n`;
    }),
    `--- Exported from BharatBridge ---`,
  ];
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="transcript-${row.id}.txt"`);
  return res.send(txtLines.join("\n"));
});

// Session Analytics & Audience Distribution Metrics
sessionsRouter.get("/:id/analytics", (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Session not found" });

  const participants = db.prepare("SELECT language, COUNT(*) as count FROM session_participants WHERE session_id = ? GROUP BY language").all(row.id);
  const segments = db.prepare("SELECT source_text FROM transcript_segments WHERE session_id = ?").all(row.id);

  const totalWords = segments.reduce((acc, s) => acc + (s.source_text ? s.source_text.split(/\s+/).length : 0), 0);
  const totalListeners = participants.reduce((acc, p) => acc + p.count, 0);

  res.json({
    sessionId: row.id,
    title: row.title,
    status: row.status,
    totalListeners,
    totalSentences: segments.length,
    totalWordsSpoken: totalWords,
    languageBreakdown: participants,
    createdAt: row.created_at,
    endedAt: row.ended_at,
  });
});

// Public Embed Code API for website integrations
sessionsRouter.get("/:id/embed", (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Session not found" });

  const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  const embedUrl = `${origin.split(",")[0]}/listen/${row.id}`;

  res.json({
    sessionId: row.id,
    embedUrl,
    iframeSnippet: `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" allow="microphone; autoplay"></iframe>`,
  });
});

const audioDir = "./data/audio";
fs.mkdirSync(audioDir, { recursive: true });

// Serve recorded speaker audio files
sessionsRouter.get("/audio/:filename", (req, res) => {
  const filePath = path.join(audioDir, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Audio recording not found" });
  }
  res.sendFile(path.resolve(filePath));
});

// Upload live recorded audio for a session
sessionsRouter.post("/:id/audio", requireAuth, express.raw({ type: "audio/*", limit: "100mb" }), (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Session not found" });
  if (row.speaker_id !== req.user.id) {
    return res.status(403).json({ error: "Only the speaker can upload audio" });
  }

  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: "Empty audio payload" });
  }

  const filename = `${row.id}.webm`;
  const filePath = path.join(audioDir, filename);
  fs.writeFileSync(filePath, req.body);

  const audioUrl = `/api/sessions/audio/${filename}`;
  db.prepare("UPDATE sessions SET audio_url = ? WHERE id = ?").run(audioUrl, row.id);

  res.json({ ok: true, audioUrl });
});

// Speaker permanently deletes a session and everything tied to it — transcript, translations,
// and participant records. Privacy control: gives speakers a real way to remove recorded
// content, not just let it sit in the database forever with no recourse.
sessionsRouter.delete("/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Session not found" });
  if (row.speaker_id !== req.user.id) {
    return res.status(403).json({ error: "Only the speaker who created this session can delete it" });
  }

  const deleteAll = db.transaction((sessionId) => {
    db.prepare(
      `DELETE FROM translations WHERE segment_id IN (SELECT id FROM transcript_segments WHERE session_id = ?)`
    ).run(sessionId);
    db.prepare(`DELETE FROM transcript_segments WHERE session_id = ?`).run(sessionId);
    db.prepare(`DELETE FROM session_participants WHERE session_id = ?`).run(sessionId);
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
  });
  deleteAll(row.id);

  res.json({ ok: true, deleted: row.id });
});

function getSessionRow(id) {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  return publicSession(row);
}

function publicSession(row) {
  return {
    id: row.id,
    joinCode: row.join_code,
    title: row.title,
    speakerId: row.speaker_id,
    speakerLanguage: row.speaker_language,
    status: row.status,
    summary: row.summary,
    audioUrl: row.audio_url || null,
    createdAt: row.created_at,
    endedAt: row.ended_at,
  };
}