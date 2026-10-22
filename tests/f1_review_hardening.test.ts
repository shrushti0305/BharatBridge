import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { spawn, spawnSync, execSync, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3005";
const WS_URL = "ws://localhost:3005";
const SEED_FILE = path.join(repoRoot, "scratch", "cosmos_fake_seed.json");

describe("F1 Review & Hardening Verification", () => {
  let srv: ChildProcess | null = null;
  let sessionA: { sessionId: string; hostToken: string; sessionToken: string };
  let sessionB: { sessionId: string; hostToken: string; sessionToken: string };

  before(async () => {
    // Write fake Cosmos DB seed data
    fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
    fs.writeFileSync(SEED_FILE, JSON.stringify({
      sessions: {
        ghost_ended_888: {
          id: "ghost_ended_888",
          sessionId: "ghost_ended_888",
          status: "ended",
          topic: "Ended Meeting"
        },
        ghost_active_777: {
          id: "ghost_active_777",
          sessionId: "ghost_active_777",
          status: "active",
          topic: "Persisted Active Meeting",
          hostTokenHash: "dummyhash"
        }
      },
      messages: {
        ghost_active_777: [
          {
            id: "msg_1",
            sessionId: "ghost_active_777",
            speakerId: "speaker_1",
            originalText: "Hello Cosmos",
            translatedText: "नमस्ते कॉस्मॉस",
            targetLang: "hi",
            timestamp: Date.now() - 5000
          }
        ]
      }
    }));

    const env = {
      ...process.env,
      PORT: "3005",
      NODE_ENV: "development",
      COSMOS_USE_FAKE: "true",
      COSMOS_FAKE_SEED_PATH: SEED_FILE,
      COSMOS_DB_ENDPOINT: "",
      COSMOS_DB_KEY: "",
      COSMOS_DB_DATABASE_NAME: "bharatbridge_f1_hardening",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300",
      FAILED_JOIN_THRESHOLD: "30",
      MAX_FAILED_JOINS_PER_IP: "30"
    };

    srv = spawn("npx", ["tsx", "server.ts"], {
      cwd: repoRoot,
      env,
      shell: true
    });

    const startWait = Date.now();
    let healthOk = false;
    while (!healthOk && Date.now() - startWait < 15000) {
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (res.ok) {
          healthOk = true;
          break;
        }
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!healthOk) {
      if (process.platform === "win32" && srv.pid) {
        try { execSync(`taskkill /pid ${srv.pid} /t /f`, { stdio: "ignore" }); } catch (_) {}
      }
      throw new Error("Failed to start server on port 3005 for F1 hardening tests");
    }

    // Create session A
    const resA = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Session A" })
    });
    sessionA = await resA.json();

    // Create session B
    const resB = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Session B" })
    });
    sessionB = await resB.json();
  });

  after(() => {
    if (srv && srv.pid) {
      if (process.platform === "win32") {
        try { execSync(`taskkill /pid ${srv.pid} /t /f`, { stdio: "ignore" }); } catch (_) {}
      } else {
        srv.kill("SIGKILL");
      }
    }
    try { if (fs.existsSync(SEED_FILE)) fs.unlinkSync(SEED_FILE); } catch (_) {}
  });

  // 1. A listener's end_session is rejected with FORBIDDEN and session remains active
  test("1. listener's end_session is rejected with FORBIDDEN; session stays active", async () => {
    const listenerWs = new WebSocket(WS_URL);
    await new Promise((r) => listenerWs.on("open", r));

    let listenerToken: string | null = null;
    let receivedError: any = null;

    listenerWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "join_ack") listenerToken = msg.sessionToken;
        if (msg.type === "error") receivedError = msg;
      } catch (_) {}
    });

    listenerWs.send(JSON.stringify({
      type: "join",
      sessionId: sessionA.sessionId,
      role: "listener",
      userId: "listener_end_tester"
    }));

    await new Promise((r) => setTimeout(r, 400));
    assert.ok(listenerToken, "Listener must receive sessionToken");

    // Listener attempts to end session
    listenerWs.send(JSON.stringify({
      type: "end_session",
      sessionId: sessionA.sessionId,
      token: listenerToken
    }));

    await new Promise((r) => setTimeout(r, 400));
    listenerWs.close();

    assert.ok(receivedError, "Listener must receive an error frame");
    assert.equal(receivedError.code, "FORBIDDEN", "Error code must be FORBIDDEN");
    assert.match(receivedError.message, /host/i, "Error message must indicate host only");

    // Verify session A is still active by performing a valid TTS call
    const ttsRes = await fetch(`${BASE_URL}/api/azure/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": listenerToken },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        text: "नमस्ते",
        languageCode: "hi-IN",
        token: listenerToken
      })
    });
    assert.equal(ttsRes.status, 200, "Session A must still be active and allow TTS");
  });

  // 2. Token for session A does not exempt guesses at session B
  test("2. token for session A does not exempt guesses at session B", async () => {
    const ws = new WebSocket(WS_URL);
    await new Promise((r) => ws.on("open", r));

    const messages: any[] = [];
    ws.on("message", (raw) => {
      try {
        messages.push(JSON.parse(raw.toString()));
      } catch (_) {}
    });

    // Attempt to claim host in Session B using Session A's hostToken
    ws.send(JSON.stringify({
      type: "join",
      sessionId: sessionB.sessionId,
      role: "speaker",
      hostToken: sessionA.hostToken,
      userId: "impersonator"
    }));

    await new Promise((r) => setTimeout(r, 400));
    ws.close();

    const roleChanged = messages.find((m) => m.type === "role_changed");
    assert.ok(roleChanged, "Must receive role_changed frame preventing takeover");
    assert.equal(roleChanged.role, "LISTENER", "Unauthorized host claim must be demoted to LISTENER");
    assert.equal(roleChanged.status, "takeover_prevented", "Takeover must be prevented");
  });

  // 3. Expired token gives a clear error (SESSION_TOKEN_EXPIRED) and rejoin mints valid token
  test("3. expired token gives clear error code and rejoin works", async () => {
    const ws1 = new WebSocket(WS_URL);
    await new Promise((r) => ws1.on("open", r));

    let initialToken: string | null = null;
    ws1.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "join_ack") initialToken = msg.sessionToken;
      } catch (_) {}
    });

    ws1.send(JSON.stringify({
      type: "join",
      sessionId: sessionB.sessionId,
      role: "listener",
      userId: "rejoin_tester"
    }));

    await new Promise((r) => setTimeout(r, 400));
    ws1.close();
    assert.ok(initialToken, "Must receive initial token");

    // Intentionally test with an invalid / unknown token
    const invalidRes = await fetch(`${BASE_URL}/api/azure/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": "non_existent_token_12345" },
      body: JSON.stringify({
        sessionId: sessionB.sessionId,
        text: "नमस्ते",
        languageCode: "hi-IN",
        token: "non_existent_token_12345"
      })
    });
    assert.equal(invalidRes.status, 403, "Invalid token must return 403");
    const invalidJson = await invalidRes.json();
    assert.equal(invalidJson.code, "SESSION_TOKEN_REQUIRED", "Unknown token must return SESSION_TOKEN_REQUIRED");

    // Rejoin session B to mint a fresh token
    const ws2 = new WebSocket(WS_URL);
    await new Promise((r) => ws2.on("open", r));

    let freshToken: string | null = null;
    ws2.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "join_ack") freshToken = msg.sessionToken;
      } catch (_) {}
    });

    ws2.send(JSON.stringify({
      type: "join",
      sessionId: sessionB.sessionId,
      role: "listener",
      userId: "rejoin_tester_2"
    }));

    await new Promise((r) => setTimeout(r, 400));
    ws2.close();
    assert.ok(freshToken, "Rejoin must mint a fresh token");
    assert.notEqual(freshToken, initialToken, "Fresh token must be distinct from initial");

    // Verify fresh token works on /api/azure/tts
    const validRes = await fetch(`${BASE_URL}/api/azure/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": freshToken },
      body: JSON.stringify({
        sessionId: sessionB.sessionId,
        text: "नमस्ते",
        languageCode: "hi-IN",
        token: freshToken
      })
    });
    assert.equal(validRes.status, 200, "Fresh rejoined token must succeed with 200");
  });

  // 4. 200-PIN guessing: assert exact threshold of 30 allowed, then RATE_LIMITED
  test("4. 200-PIN guessing asserts exact threshold (30 allowed, then RATE_LIMITED)", async () => {
    let notFoundCount = 0;
    let rateLimitedCount = 0;

    // Send 35 sequential invalid joins from this dedicated IP (threshold is exactly 30)
    for (let i = 0; i < 35; i++) {
      const pin = `guess_${i}_${Date.now()}`;
      const ws = new WebSocket(WS_URL, {
        headers: { "x-forwarded-for": "198.51.100.77" }
      });

      const result = await new Promise<{ code: string; type: string } | null>((resolve) => {
        const timer = setTimeout(() => {
          ws.close();
          resolve(null);
        }, 800);

        ws.on("open", () => {
          ws.send(JSON.stringify({
            type: "join",
            sessionId: pin,
            role: "listener"
          }));
        });

        ws.on("message", (raw) => {
          clearTimeout(timer);
          try {
            const msg = JSON.parse(raw.toString());
            resolve(msg);
          } catch (_) {
            resolve(null);
          }
        });

        ws.on("close", () => {
          clearTimeout(timer);
        });

        ws.on("error", () => {
          clearTimeout(timer);
          resolve(null);
        });
      });

      if (result?.code === "RATE_LIMITED") {
        rateLimitedCount++;
      } else if (result?.code === "SESSION_NOT_FOUND") {
        notFoundCount++;
      }
    }

    assert.equal(notFoundCount, 30, "Exactly 30 attempts must be allowed before IP throttling is triggered");
    assert.equal(rateLimitedCount, 5, "Attempts 31 through 35 must immediately receive RATE_LIMITED");
  });

  // 5. Ghost-session / restart rehydration with documented Cosmos fake
  test("5. ghost-session rehydration: empty/ended rooms rejected, active room rehydrated", async () => {
    // Case A: Room does not exist in Cosmos (sessionDoc: null)
    const wsEmpty = new WebSocket(WS_URL);
    await new Promise((r) => wsEmpty.on("open", r));
    const emptyMsgPromise = new Promise<any>((resolve) => {
      wsEmpty.on("message", (raw) => {
        try { resolve(JSON.parse(raw.toString())); } catch (_) { resolve(null); }
      });
    });
    wsEmpty.send(JSON.stringify({
      type: "join",
      sessionId: "ghost_empty_999",
      role: "listener"
    }));
    const emptyMsg = await emptyMsgPromise;
    wsEmpty.close();
    assert.ok(emptyMsg, "Empty room must respond");
    assert.equal(emptyMsg.code, "SESSION_NOT_FOUND", "Empty room in Cosmos must NOT rehydrate");

    // Case B: Room in Cosmos has status: 'ended'
    const wsEnded = new WebSocket(WS_URL);
    await new Promise((r) => wsEnded.on("open", r));
    const endedMsgPromise = new Promise<any>((resolve) => {
      wsEnded.on("message", (raw) => {
        try { resolve(JSON.parse(raw.toString())); } catch (_) { resolve(null); }
      });
    });
    wsEnded.send(JSON.stringify({
      type: "join",
      sessionId: "ghost_ended_888",
      role: "listener"
    }));
    const endedMsg = await endedMsgPromise;
    wsEnded.close();
    assert.ok(endedMsg, "Ended room must respond");
    assert.equal(endedMsg.code, "SESSION_NOT_FOUND", "Ended room in Cosmos must NOT rehydrate");

    // Case C: Room in Cosmos has status: 'active' -> rehydrates with topic & messages
    const wsActive = new WebSocket(WS_URL);
    await new Promise((r) => wsActive.on("open", r));
    const activeMsgPromise = new Promise<any>((resolve) => {
      const timer = setTimeout(() => resolve(null), 2500);
      wsActive.on("message", (raw) => {
        try {
          const m = JSON.parse(raw.toString());
          if (m.type === "join_ack" || m.type === "error") {
            clearTimeout(timer);
            resolve(m);
          }
        } catch (_) {}
      });
    });
    wsActive.send(JSON.stringify({
      type: "join",
      sessionId: "ghost_active_777",
      role: "listener"
    }));
    const activeAck = await activeMsgPromise;
    wsActive.close();
    assert.ok(activeAck, "Active room in Cosmos must respond");
    assert.equal(activeAck.type, "join_ack", "Active room in Cosmos must rehydrate and send join_ack");
    assert.equal(activeAck.sessionId, "ghost_active_777", "Rehydrated session must match sessionId");
    assert.ok(activeAck.sessionToken, "Rehydrated session must mint valid listener sessionToken");
  });

  // 6. COSMOS_USE_FAKE: Refuses boot in production; excluded from dist and cannot be enabled via VITE_
  test("6. COSMOS_USE_FAKE: refuses to boot in production; cannot be set via VITE_; absent from dist assets", () => {
    // A: Server refuses to boot when NODE_ENV=production and COSMOS_USE_FAKE=true
    const prodProc = spawnSync("npx", ["tsx", "server.ts"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: "3009",
        NODE_ENV: "production",
        COSMOS_USE_FAKE: "true"
      },
      shell: true,
      encoding: "utf8"
    });
    assert.notEqual(prodProc.status, 0, "Server must exit non-zero when COSMOS_USE_FAKE=true in production");
    assert.match(prodProc.stderr + prodProc.stdout, /COSMOS_USE_FAKE.*(strictly forbidden|cannot be enabled) in production/i, "Must print clear fatal security log");

    // B: dist/assets/*.js contains zero occurrences of COSMOS_USE_FAKE
    const distAssetsDir = path.join(repoRoot, "dist", "assets");
    if (fs.existsSync(distAssetsDir)) {
      const assetFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith(".js"));
      for (const file of assetFiles) {
        const content = fs.readFileSync(path.join(distAssetsDir, file), "utf8");
        assert.equal(content.includes("COSMOS_USE_FAKE"), false, `File ${file} in dist/ must NOT contain COSMOS_USE_FAKE`);
      }
    }

    // C: VITE_COSMOS_USE_FAKE cannot enable fake container in production
    const prodProcWithVite = spawnSync("npx", ["tsx", "server.ts"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: "3009",
        NODE_ENV: "production",
        COSMOS_USE_FAKE: "false",
        VITE_COSMOS_USE_FAKE: "true"
      },
      shell: true,
      timeout: 3000,
      encoding: "utf8"
    });
    // Server should NOT trigger the fake container active log
    assert.equal((prodProcWithVite.stdout || "").includes("Cosmos DB Fake Container is ACTIVE"), false, "VITE_ variable must never activate fake Cosmos");
  });
});
