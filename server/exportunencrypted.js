import Database from "better-sqlite3-multiple-ciphers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const sourcePath = path.resolve(__dirname, "data/live-translate.db");
const targetPath = path.resolve(__dirname, "data/live-translate-unencrypted.db");

if (fs.existsSync(targetPath)) {
  fs.unlinkSync(targetPath);
}

// 1. Open source encrypted database
const srcDb = new Database(sourcePath);
srcDb.pragma(`key = '${process.env.DB_ENCRYPTION_KEY.replace(/'/g, "''")}'`);

// 2. Create brand-new target database without ANY encryption pragma (plain SQLite 3)
const targetDb = new Database(targetPath);

targetDb.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    join_code TEXT UNIQUE NOT NULL,
    speaker_id TEXT NOT NULL,
    title TEXT NOT NULL,
    speaker_language TEXT NOT NULL DEFAULT 'auto',
    status TEXT NOT NULL DEFAULT 'live',
    summary TEXT,
    audio_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT
  );
  CREATE TABLE transcript_segments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    source_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE translations (
    id TEXT PRIMARY KEY,
    segment_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    language TEXT NOT NULL,
    translated_text TEXT NOT NULL
  );
`);

// 3. Copy rows across tables
const users = srcDb.prepare("SELECT * FROM users").all();
const insertUser = targetDb.prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)");
for (const u of users) insertUser.run(u.id, u.name, u.email, u.password_hash, u.created_at);

const sessions = srcDb.prepare("SELECT * FROM sessions").all();
const insertSession = targetDb.prepare("INSERT INTO sessions (id, join_code, speaker_id, title, speaker_language, status, summary, audio_url, created_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
for (const s of sessions) insertSession.run(s.id, s.join_code, s.speaker_id, s.title, s.speaker_language, s.status, s.summary, s.audio_url, s.created_at, s.ended_at);

const segments = srcDb.prepare("SELECT * FROM transcript_segments").all();
const insertSegment = targetDb.prepare("INSERT INTO transcript_segments (id, session_id, seq, source_text, created_at) VALUES (?, ?, ?, ?, ?)");
for (const s of segments) insertSegment.run(s.id, s.session_id, s.seq, s.source_text, s.created_at);

const translations = srcDb.prepare("SELECT * FROM translations").all();
const insertTranslation = targetDb.prepare("INSERT INTO translations (id, segment_id, session_id, language, translated_text) VALUES (?, ?, ?, ?, ?)");
for (const t of translations) insertTranslation.run(t.id, t.segment_id, t.session_id, t.language, t.translated_text);

console.log("SUCCESS: Exported 100% plain unencrypted SQLite database to:", targetPath);
srcDb.close();
targetDb.close();
