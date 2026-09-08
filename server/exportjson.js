import Database from "better-sqlite3-multiple-ciphers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const dbPath = path.resolve(__dirname, "data/live-translate.db");
if (!fs.existsSync(dbPath)) {
  console.error("Database file not found at", dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
if (process.env.DB_ENCRYPTION_KEY) {
  db.pragma(`key = '${process.env.DB_ENCRYPTION_KEY.replace(/'/g, "''")}'`);
}

const users = db.prepare("SELECT id, name, email, created_at FROM users").all();
const sessions = db.prepare("SELECT id, join_code, title, status, audio_url, created_at FROM sessions").all();
const transcripts = db.prepare("SELECT id, session_id, seq, source_text, created_at FROM transcript_segments ORDER BY created_at DESC").all();
const translations = db.prepare("SELECT id, segment_id, language, translated_text FROM translations ORDER BY id DESC").all();

fs.writeFileSync(path.resolve(__dirname, "data/users.json"), JSON.stringify(users, null, 2));
fs.writeFileSync(path.resolve(__dirname, "data/sessions.json"), JSON.stringify(sessions, null, 2));
fs.writeFileSync(path.resolve(__dirname, "data/transcripts.json"), JSON.stringify(transcripts, null, 2));
fs.writeFileSync(path.resolve(__dirname, "data/translations.json"), JSON.stringify(translations, null, 2));

console.log("Database exported to VS Code readable JSON files in server/data/:");
console.log("- server/data/users.json");
console.log("- server/data/sessions.json");
console.log("- server/data/transcripts.json");
console.log("- server/data/translations.json");

db.close();
