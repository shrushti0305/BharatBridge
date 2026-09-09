import Database from "better-sqlite3-multiple-ciphers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const dbPath = process.env.DB_PATH || "./data/live-translate.db";
const encryptionKey = process.env.DB_ENCRYPTION_KEY || "ShrushtiTaur@2005";
const outputPath = "./data/live-translate-view.db";

if (!fs.existsSync(dbPath)) {
  console.error("Database file not found at:", dbPath);
  process.exit(1);
}

try {
  // Open encrypted DB
  const encryptedDb = new Database(dbPath);
  encryptedDb.pragma(`key = '${encryptionKey.replace(/'/g, "''")}'`);

  // Remove existing view copy if present
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  // Create unencrypted database copy
  const plainDb = new Database(outputPath);

  // Read schema and data from encrypted DB and copy to plain DB
  const tables = encryptedDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

  plainDb.exec("PRAGMA foreign_keys = OFF;");

  for (const table of tables) {
    if (!table.sql) continue;
    plainDb.exec(table.sql);
    const rows = encryptedDb.prepare(`SELECT * FROM "${table.name}"`).all();
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      const placeholders = keys.map(() => "?").join(",");
      const insertStmt = plainDb.prepare(`INSERT INTO "${table.name}" (${keys.map(k => `"${k}"`).join(",")}) VALUES (${placeholders})`);
      const insertMany = plainDb.transaction((allRows) => {
        for (const row of allRows) {
          insertStmt.run(Object.values(row));
        }
      });
      insertMany(rows);
    }
  }

  plainDb.close();
  encryptedDb.close();

  console.log("\n✅ Decrypted copy created successfully at:");
  console.log(`   ${path.resolve(outputPath)}`);
  console.log("\n📂 You can now open 'live-translate-view.db' directly in DB Browser for SQLite with NO errors!\n");
} catch (err) {
  console.error("Failed to export database copy:", err.message);
}
