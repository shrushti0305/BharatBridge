import Database from "better-sqlite3-multiple-ciphers";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "data/live-translate.db");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("🔐 Enter Database Password: ", (enteredPassword) => {
  rl.close();
  try {
    const db = new Database(dbPath);
    db.pragma(`key = '${enteredPassword.replace(/'/g, "''")}'`);

    // Test query to verify key
    const users = db.prepare("SELECT id, name, email, created_at FROM users").all();

    console.log("\n✅ Password Accepted! Unlocking Database:\n");

    console.log("=== USERS ===");
    console.table(users);

    console.log("\n=== SESSIONS ===");
    console.table(db.prepare("SELECT id, join_code, title, status, audio_url, created_at FROM sessions").all());

    console.log("\n=== TRANSCRIPT SEGMENTS ===");
    console.table(db.prepare("SELECT id, session_id, seq, source_text, created_at FROM transcript_segments ORDER BY created_at DESC LIMIT 10").all());

    console.log("\n=== TRANSLATIONS ===");
    console.table(db.prepare("SELECT id, segment_id, language, translated_text FROM translations ORDER BY id DESC LIMIT 10").all());

    db.close();
  } catch (err) {
    console.error("\n❌ ACCESS DENIED: Incorrect Password or Encrypted File!");
  }
});