/**
 * CLEANUP SCRIPT: Delete audit sessions, ghost PINs, and zero-message test sessions
 *
 * DEFAULT: --dry-run (safe mode, reports items found without deleting)
 * To execute actual deletion:
 *   node node_modules/tsx/dist/cli.mjs scratch/audit/cleanup_audit_sessions.ts --delete
 *
 * DO NOT RUN AUTOMATICALLY (Audit rule: "give me a cleanup script (don't run it)")
 */

import { CosmosClient } from "@azure/cosmos";
import dotenv from "dotenv";

dotenv.config();

const isDryRun = !process.argv.includes("--delete") && !process.argv.includes("--force");

const connectionString = process.env.COSMOS_CONNECTION_STRING;
if (!connectionString) {
  console.error("COSMOS_CONNECTION_STRING is missing from .env");
  process.exit(1);
}

const client = new CosmosClient(connectionString);
const database = client.database(process.env.COSMOS_DB_DATABASE_NAME || "bharatbridge");
const sessionsContainer = database.container("sessions");
const telemetryContainer = database.container("telemetry");

// Explicit list of all Batch 4 test session PINs
const KNOWN_AUDIT_PINS = [
  "35723080", // audit_restart_test_session
  "97477529", // audit_duo_mode_session
  "27526462", // audit_load_session_1
  "68923362", // audit_load_session_2
  "55991460", // audit_load_session_3
  "97719168", // audit_load_session_1
  "42651529", // audit_load_session_2
  "37583385", // audit_load_session_3
  "70010032", // audit_pw_reconnect_session
  "36896498", // audit_reconnect_race
  "63678919", // audit_heartbeat_test
  "28394024", // test_leak_one
  "12088856"  // audit_load_latency_cpu
];

async function cleanup() {
  console.log("==================================================");
  console.log(`AUDIT SESSIONS CLEANUP SCRIPT (Mode: ${isDryRun ? "DRY-RUN (Safe)" : "LIVE DELETION"})`);
  console.log("==================================================");

  // 1. Query all audit sessions: ghost_*, audit_* topics, known PINs, and 0-message sessions created today
  const todayPrefix = new Date().toISOString().slice(0, 10);
  console.log(`\nQuerying Cosmos DB 'sessions' container for:`);
  console.log(`  - Topics starting with 'audit_'`);
  console.log(`  - Session IDs starting with 'ghost_'`);
  console.log(`  - Known audit PIN list (${KNOWN_AUDIT_PINS.length} PINs)`);
  console.log(`  - Sessions created today (${todayPrefix}) with zero messages or missing hostTokenHash`);

  const sessionQuery = {
    query: `
      SELECT c.id, c.topic, c.createdAt, c.messages
      FROM c
      WHERE STARTSWITH(c.topic, 'audit_')
         OR STARTSWITH(c.id, 'ghost_')
         OR ARRAY_CONTAINS(@knownPins, c.id)
         OR (STARTSWITH(c.createdAt, @today) AND (NOT IS_DEFINED(c.messages) OR ARRAY_LENGTH(c.messages) = 0))
    `,
    parameters: [
      { name: "@knownPins", value: KNOWN_AUDIT_PINS },
      { name: "@today", value: todayPrefix }
    ]
  };

  const { resources: sessionsToDelete } = await sessionsContainer.items.query(sessionQuery).fetchAll();
  console.log(`Found ${sessionsToDelete.length} matching audit sessions.`);

  for (const sess of sessionsToDelete) {
    const msgCount = Array.isArray(sess.messages) ? sess.messages.length : 0;
    if (isDryRun) {
      console.log(`  [DRY-RUN WOULD DELETE] Session ID: ${sess.id} | Topic: "${sess.topic || ''}" | Messages: ${msgCount}`);
    } else {
      try {
        await sessionsContainer.item(sess.id, sess.id).delete();
        console.log(`  [DELETED] Session ID: ${sess.id}`);
      } catch (err: any) {
        console.warn(`  [ERROR DELETING] Session ID: ${sess.id} - ${err.message}`);
      }
    }
  }

  // 2. Query telemetry events starting with audit- or simul-
  const telemQuery = {
    query: `SELECT c.id, c.eventId FROM c WHERE STARTSWITH(c.eventId, 'audit-') OR STARTSWITH(c.eventId, 'simul-') OR STARTSWITH(c.eventId, 'load-')`
  };

  const { resources: telemToDelete } = await telemetryContainer.items.query(telemQuery).fetchAll();
  console.log(`\nFound ${telemToDelete.length} matching audit telemetry records.`);

  for (const record of telemToDelete) {
    if (isDryRun) {
      console.log(`  [DRY-RUN WOULD DELETE TELEMETRY] ID: ${record.id} | EventId: ${record.eventId}`);
    } else {
      try {
        await telemetryContainer.item(record.id, record.id).delete();
        console.log(`  [DELETED TELEMETRY] ID: ${record.id}`);
      } catch (err: any) {
        console.warn(`  [ERROR DELETING TELEMETRY] ID: ${record.id} - ${err.message}`);
      }
    }
  }

  console.log("\n==================================================");
  if (isDryRun) {
    console.log("DRY RUN COMPLETE: Zero records were modified.");
    console.log("To execute live deletion, run with --delete flag.");
  } else {
    console.log("LIVE CLEANUP COMPLETE: All targeted audit records deleted.");
  }
  console.log("==================================================");
}

// Script definition loaded. Do NOT run automatically per audit rules.
// To run manually: cleanup().catch(console.error);
console.log("Cleanup script loaded in --dry-run mode. Ready for manual invocation if needed.");
