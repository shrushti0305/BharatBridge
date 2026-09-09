import Database from "better-sqlite3-multiple-ciphers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const sqlitePath = process.env.DB_PATH || "./data/live-translate.db";
const encryptionKey = process.env.DB_ENCRYPTION_KEY || "ShrushtiTaur@2005";
const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!pgUrl) {
  console.error("\n❌ Error: DATABASE_URL (or POSTGRES_URL) is not set in server/.env!");
  console.error("Please add your PostgreSQL connection string to server/.env first.");
  console.error("Example: DATABASE_URL=postgresql://postgres:password@localhost:5432/trylang\n");
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  console.error("❌ Error: Local SQLite database file not found at:", sqlitePath);
  process.exit(1);
}

console.log("\n🚀 Starting Migration from SQLite (SQLCipher) to PostgreSQL...");
console.log(`📁 Source Database: ${path.resolve(sqlitePath)}`);
console.log(`🌐 Target Database: ${pgUrl.replace(/:[^:@]+@/, ":****@")}\n`);

async function runMigration() {
  // 1. Connect to SQLite (SQLCipher)
  const sqlite = new Database(sqlitePath);
  if (encryptionKey) {
    sqlite.pragma(`key = '${encryptionKey.replace(/'/g, "''")}'`);
  }

  // 2. Connect to PostgreSQL
  const pool = new Pool({
    connectionString: pgUrl,
    ssl: pgUrl.includes("localhost") || pgUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log("✅ Connected successfully to PostgreSQL database.");

    // 3. Initialize PostgreSQL Tables
    console.log("📦 Creating PostgreSQL table schemas...");
    await client.query(`
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
    `);

    // 4. Migrate Data Table by Table
    const tables = ["users", "password_reset_tokens", "sessions", "transcript_segments", "translations", "session_participants", "session_questions"];

    for (const table of tables) {
      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
      if (rows.length === 0) {
        console.log(`  - Table '${table}': 0 rows to migrate.`);
        continue;
      }

      console.log(`  - Migrating '${table}': ${rows.length} rows...`);

      const columns = Object.keys(rows[0]);
      const colNamesStr = columns.map(c => `"${c}"`).join(", ");

      for (const row of rows) {
        const values = Object.values(row);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
        const insertSql = `INSERT INTO "${table}" (${colNamesStr}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
        await client.query(insertSql, values);
      }
      console.log(`    ✅ Migrated ${rows.length} rows into '${table}'.`);
    }

    client.release();
    sqlite.close();
    await pool.end();

    console.log("\n=======================================================");
    console.log("🎉 MIGRATION COMPLETE! ALL DATA COPIED TO POSTGRESQL.");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("\n❌ Migration Failed:", err.message);
    sqlite.close();
    await pool.end();
    process.exit(1);
  }
}

runMigration();
