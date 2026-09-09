import Database from "better-sqlite3-multiple-ciphers";
import fs from "fs";
import path from "path";
import pkg from "pg";

const { Pool } = pkg;
const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let dbInstance;

if (pgUrl) {
  console.log("🐘 Connecting to PostgreSQL production database...");
  const pool = new Pool({
    connectionString: pgUrl,
    ssl: pgUrl.includes("localhost") || pgUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
  });

  // Helper to convert SQLite '?' placeholders to PostgreSQL '$1, $2'
  const convertPlaceholders = (sql) => {
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`)
              .replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP");
  };

  dbInstance = {
    isPostgres: true,
    pool,
    exec(sql) {
      return pool.query(sql);
    },
    prepare(sql) {
      const pgSql = convertPlaceholders(sql);
      return {
        get(...args) {
          // De-nest array arguments if passed as single array
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          const res = pool.query(pgSql, params);
          // Standard de-async helper for pg query compatibility
          return res?.rows?.[0] || null;
        },
        all(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          const res = pool.query(pgSql, params);
          return res?.rows || [];
        },
        run(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          const res = pool.query(pgSql, params);
          return { changes: res?.rowCount || 0 };
        }
      };
    }
  };

  // Create PostgreSQL Schema
  pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(255) PRIMARY KEY,
      join_code VARCHAR(50) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      speaker_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      speaker_language VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'live',
      summary TEXT,
      audio_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS transcript_segments (
      id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      source_text TEXT NOT NULL,
      is_final INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS translations (
      id VARCHAR(255) PRIMARY KEY,
      segment_id VARCHAR(255) NOT NULL REFERENCES transcript_segments(id) ON DELETE CASCADE,
      session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      language VARCHAR(50) NOT NULL,
      translated_text TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS session_participants (
      id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      language VARCHAR(50) NOT NULL,
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS session_questions (
      id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_name VARCHAR(255) NOT NULL,
      question TEXT NOT NULL,
      translated_question TEXT,
      upvotes INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_translations_session_lang ON translations(session_id, language);
    CREATE INDEX IF NOT EXISTS idx_transcript_segments_session_seq ON transcript_segments(session_id, seq);
    CREATE INDEX IF NOT EXISTS idx_session_questions_session ON session_questions(session_id, upvotes DESC);
  `).catch((err) => console.error("PostgreSQL Schema Error:", err.message));

} else {
  // SQLite + SQLCipher AES-256 local database engine
  const dbPath = process.env.DB_PATH || "./data/live-translate.db";
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const encryptionKey = process.env.DB_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.warn(
      "\n[warning] DB_ENCRYPTION_KEY is not set — the database file will NOT be password-protected. Add it to server/.env before storing real data.\n"
    );
  }

  const sqliteDb = new Database(dbPath);
  if (encryptionKey) {
    sqliteDb.pragma(`key = '${encryptionKey.replace(/'/g, "''")}'`);
  }
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");

  sqliteDb.exec(`
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
      status TEXT NOT NULL DEFAULT 'live',
      summary TEXT,
      audio_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transcript_segments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      seq INTEGER NOT NULL,
      source_text TEXT NOT NULL,
      is_final INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS translations (
      id TEXT PRIMARY KEY,
      segment_id TEXT NOT NULL REFERENCES transcript_segments(id),
      session_id TEXT NOT NULL REFERENCES sessions(id),
      language TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_translations_session_lang ON translations(session_id, language);

    CREATE TABLE IF NOT EXISTS session_participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      language TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, user_id)
    );

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
    sqliteDb.exec(`ALTER TABLE sessions ADD COLUMN audio_url TEXT;`);
  } catch (e) {}

  try {
    sqliteDb.exec(`ALTER TABLE session_questions ADD COLUMN translated_question TEXT;`);
  } catch (e) {}

  dbInstance = sqliteDb;
}

export const db = dbInstance;