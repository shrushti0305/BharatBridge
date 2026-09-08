import Database from "better-sqlite3-multiple-ciphers";
import fs from "fs";
import path from "path";

const dbPath = process.env.DB_PATH || "./data/live-translate.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const encryptionKey = process.env.DB_ENCRYPTION_KEY;
if (!encryptionKey) {
  console.warn(
    "\n[warning] DB_ENCRYPTION_KEY is not set — the database file will NOT be password-protected. Add it to server/.env before storing real data.\n"
  );
}

export const db = new Database(dbPath);
if (encryptionKey) {
  // Must be the very first thing done on the connection, before any other pragma or query —
  // this is what makes the file unreadable without the key (verified: without it, or with the
  // wrong key, SQLite reports the file as "not a database" rather than showing any content).
  db.pragma(`key = '${encryptionKey.replace(/'/g, "''")}'`);
}
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  join_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  speaker_id TEXT NOT NULL REFERENCES users(id),
  speaker_language TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live', -- live | ended
  summary TEXT,
  audio_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);

-- Every original utterance the speaker says (source language transcript).
CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER NOT NULL,
  source_text TEXT NOT NULL,
  is_final INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-language translation of each segment, so every listener's history is retrievable.
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  segment_id TEXT NOT NULL REFERENCES transcript_segments(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_translations_session_lang ON translations(session_id, language);

-- Which listeners attended which sessions, and in which language, for "My Sessions" history.
CREATE TABLE IF NOT EXISTS session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, user_id)
);

-- Live Audience Questions & Real-Time Upvoting
CREATE TABLE IF NOT EXISTS session_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  question TEXT NOT NULL,
  translated_question TEXT,
  upvotes INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_session_seq ON transcript_segments(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_session_questions_session ON session_questions(session_id, upvotes DESC);
`);

try {
  db.exec(`ALTER TABLE sessions ADD COLUMN audio_url TEXT;`);
} catch (e) {
  // column already exists
}

try {
  db.exec(`ALTER TABLE session_questions ADD COLUMN translated_question TEXT;`);
} catch (e) {
  // column already exists
}