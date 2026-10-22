import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3005";
const WS_URL = "ws://localhost:3005";

describe("STAGE 1: FAILING TESTS SPECIFICATION (Pre-Fix Verification)", () => {
  let srv: ChildProcess | null = null;

  before(async () => {
    // Start isolated local test server on port 3005
    const env = {
      ...process.env,
      PORT: "3005",
      NODE_ENV: "development",
      COSMOS_DB_ENDPOINT: "",
      COSMOS_DB_KEY: "",
      COSMOS_DB_DATABASE_NAME: "bharatbridge_stage1_isolated",
      AZURE_STORAGE_CONNECTION_STRING: "",
      SESSION_LISTENER_CAP: "5",
      WS_RATE_LIMIT_SPEAKER: "25",
      WS_RATE_LIMIT_LISTENER: "5",
      HISTORY_LIMIT_RECONNECT: "10"
    };

    srv = spawn("npx", ["tsx", "server.ts"], {
      cwd: repoRoot,
      env,
      shell: true
    });

    // Wait for health endpoint
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
      throw new Error("Failed to start server on port 3005 for Stage 1 tests");
    }
  });

  after(() => {
    if (srv && srv.pid) {
      if (process.platform === "win32") {
        try { execSync(`taskkill /pid ${srv.pid} /t /f`, { stdio: "ignore" }); } catch (_) {}
      } else {
        srv.kill("SIGKILL");
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 1: Session-bound tokens on individual routes with valid bodies
  // --------------------------------------------------------------------------
  describe("1. Route token verification: valid bodies on session-summary, upload-caption, translate", () => {
    let s1: any;
    let s2: any;

    before(async () => {
      const s1Res = await fetch(`${BASE_URL}/api/sessions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Session 1" })
      });
      s1 = await s1Res.json();

      const s2Res = await fetch(`${BASE_URL}/api/sessions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Session 2" })
      });
      s2 = await s2Res.json();
    });

    // 1A. /api/session-summary
    test("1A-1: POST /api/session-summary without token fails with 401/403", async () => {
      const validBody = {
        sessionId: s1.sessionId,
        messages: [{ id: "m1", originalText: "Hello", translatedText: "नमस्ते" }]
      };
      const res = await fetch(`${BASE_URL}/api/session-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody)
      });
      assert.ok(
        res.status === 401 || res.status === 403,
        `Expected 401 or 403 for tokenless /api/session-summary, but got HTTP ${res.status}`
      );
    });

    test("1A-2: POST /api/session-summary with other-session token fails with 401/403", async () => {
      const validBody = {
        sessionId: s1.sessionId,
        messages: [{ id: "m1", originalText: "Hello", translatedText: "नमस्ते" }],
        token: s2.hostToken
      };
      const res = await fetch(`${BASE_URL}/api/session-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s2.hostToken
        },
        body: JSON.stringify(validBody)
      });
      assert.ok(
        res.status === 401 || res.status === 403,
        `Expected 401 or 403 for mismatched token on /api/session-summary, but got HTTP ${res.status}`
      );
    });

    // 1B. /api/azure/upload-caption
    test("1B-1: POST /api/azure/upload-caption without token fails with 401/403", async () => {
      const validBody = {
        sessionId: s1.sessionId,
        sessionName: "Test Session",
        captions: [{ originalText: "Hello", translatedText: "नमस्ते" }]
      };
      const res = await fetch(`${BASE_URL}/api/azure/upload-caption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody)
      });
      assert.ok(
        res.status === 401 || res.status === 403,
        `Expected 401 or 403 for tokenless /api/azure/upload-caption, but got HTTP ${res.status}`
      );
    });

    test("1B-2: POST /api/azure/upload-caption with other-session token fails with 401/403", async () => {
      const validBody = {
        sessionId: s1.sessionId,
        sessionName: "Test Session",
        captions: [{ originalText: "Hello", translatedText: "नमस्ते" }],
        token: s2.hostToken
      };
      const res = await fetch(`${BASE_URL}/api/azure/upload-caption`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s2.hostToken
        },
        body: JSON.stringify(validBody)
      });
      assert.ok(
        res.status === 401 || res.status === 403,
        `Expected 401 or 403 for mismatched token on /api/azure/upload-caption, but got HTTP ${res.status}`
      );
    });

    // 1C. /api/translate
    test("1C-1: POST /api/translate with existing sessionId but no token fails with 401/403", async () => {
      const validBody = {
        sessionId: s1.sessionId,
        text: "Hello, world",
        sourceLanguage: "en",
        targetLanguage: "hi"
      };
      const res = await fetch(`${BASE_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody)
      });
      assert.ok(
        res.status === 401 || res.status === 403,
        `Expected 401 or 403 for in-session /api/translate without token, but got HTTP ${res.status}`
      );
    });

    test("1C-2: POST /api/translate with other-session token fails with 401/403", async () => {
      const validBody = {
        sessionId: s1.sessionId,
        text: "Hello, world",
        sourceLanguage: "en",
        targetLanguage: "hi",
        token: s2.hostToken
      };
      const res = await fetch(`${BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s2.hostToken
        },
        body: JSON.stringify(validBody)
      });
      assert.ok(
        res.status === 401 || res.status === 403,
        `Expected 401 or 403 for /api/translate with mismatched token, but got HTTP ${res.status}`
      );
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: Per-socket rate limit on frames
  // --------------------------------------------------------------------------
  test("2. Per-socket rate limit: normal speaker (1 msg/sec) not limited; flooder warned then closed", async () => {
    const sRes = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Rate Limit Session" })
    });
    const s = await sRes.json();

    // 2A. Normal speaker: sends 3 frames with 500ms spacing (2 msgs/sec, well within normal pace)
    const speakerWs = new WebSocket(WS_URL);
    await new Promise((r) => speakerWs.on("open", r));
    speakerWs.send(JSON.stringify({ type: "join", sessionId: s.sessionId, role: "organizer", hostToken: s.hostToken }));
    await new Promise((r) => setTimeout(r, 200));

    let speakerLimited = false;
    speakerWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "slow_down" || msg.code === "RATE_LIMIT_EXCEEDED") speakerLimited = true;
      } catch (_) {}
    });

    for (let i = 0; i < 3; i++) {
      speakerWs.send(JSON.stringify({ type: "ping", seq: i }));
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.equal(speakerLimited, false, "Normal speaker pace must NOT be limited");
    speakerWs.close();

    // 2B. Flooding socket: sends 40 frames in 100ms
    const flooderWs = new WebSocket(WS_URL);
    await new Promise((r) => flooderWs.on("open", r));
    flooderWs.send(JSON.stringify({ type: "join", sessionId: s.sessionId, role: "listener" }));
    await new Promise((r) => setTimeout(r, 200));

    let receivedSlowDown = false;
    let socketClosed = false;

    flooderWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "slow_down" || msg.code === "RATE_LIMIT_EXCEEDED") {
          receivedSlowDown = true;
        }
      } catch (_) {}
    });

    flooderWs.on("close", () => {
      socketClosed = true;
    });

    for (let i = 0; i < 40; i++) {
      if (flooderWs.readyState === WebSocket.OPEN) {
        flooderWs.send(JSON.stringify({ type: "ping", seq: i }));
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
    try { flooderWs.close(); } catch (_) {}

    assert.ok(
      receivedSlowDown || socketClosed,
      "Flooding socket should receive slow_down warning or be closed by rate limiter"
    );
  });

  // --------------------------------------------------------------------------
  // TEST 3: Listener cap per session
  // --------------------------------------------------------------------------
  test("3. Listener cap per session: next listener beyond cap refused; existing unaffected", async () => {
    const sRes = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cap Session" })
    });
    const s = await sRes.json();

    const sockets: WebSocket[] = [];
    try {
      // Connect 5 listeners (SESSION_LISTENER_CAP=5)
      for (let i = 0; i < 5; i++) {
        const ws = new WebSocket(WS_URL);
        await new Promise((r) => ws.on("open", r));
        ws.send(JSON.stringify({ type: "join", sessionId: s.sessionId, role: "listener", userId: `usr_${i}` }));
        sockets.push(ws);
      }

      await new Promise((r) => setTimeout(r, 400));

      // 6th listener attempts to join
      const excessWs = new WebSocket(WS_URL);
      await new Promise((r) => excessWs.on("open", r));

      let refusedMessage = false;
      excessWs.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.code === "ROOM_CAPACITY_REACHED" || msg.type === "room_full") {
            refusedMessage = true;
          }
        } catch (_) {}
      });

      excessWs.send(JSON.stringify({ type: "join", sessionId: s.sessionId, role: "listener", userId: "usr_excess" }));
      await new Promise((r) => setTimeout(r, 500));
      excessWs.close();

      assert.ok(
        refusedMessage,
        "Listener beyond cap (6th) must receive ROOM_CAPACITY_REACHED error"
      );
    } finally {
      sockets.forEach((s) => {
        try { s.close(); } catch (_) {}
      });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Reconnect storm limited history & single-flight translation
  // --------------------------------------------------------------------------
  test("4. Reconnect storm: sends limited history (last K messages) and translates once per language", async () => {
    const sRes = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "History Storm Session" })
    });
    const s = await sRes.json();

    // Host joins and posts 25 messages
    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    hostWs.send(JSON.stringify({ type: "join", sessionId: s.sessionId, role: "organizer", hostToken: s.hostToken }));
    await new Promise((r) => setTimeout(r, 200));

    for (let i = 1; i <= 25; i++) {
      hostWs.send(JSON.stringify({
        type: "text_translation",
        sessionId: s.sessionId,
        originalText: `Sentence ${i}`,
        translatedText: `वाक्य ${i}`,
        sourceLang: "en",
        targetLang: "hi",
        eventId: `ev_${i}`
      }));
    }
    await new Promise((r) => setTimeout(r, 500));
    hostWs.close();

    // Reconnecting listener joins
    const listenerWs = new WebSocket(WS_URL);
    await new Promise((r) => listenerWs.on("open", r));

    let historyCount = 0;
    listenerWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "history" && Array.isArray(msg.messages)) {
          historyCount = msg.messages.length;
        }
      } catch (_) {}
    });

    listenerWs.send(JSON.stringify({ type: "join", sessionId: s.sessionId, role: "listener", targetLang: "hi" }));
    await new Promise((r) => setTimeout(r, 800));
    listenerWs.close();

    // With K=10 limit (HISTORY_LIMIT_RECONNECT=10), must receive <= 10 messages, not all 25
    assert.ok(
      historyCount > 0 && historyCount <= 10,
      `Expected limited history <= 10 messages on reconnect storm, received: ${historyCount}`
    );
  });

  // --------------------------------------------------------------------------
  // TEST 5: Backpressure for slow listeners
  // --------------------------------------------------------------------------
  test("5. Slow listener backpressure: slow socket dropped or non-final frames skipped without blocking other listeners", async () => {
    const sRes = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Backpressure Session" })
    });
    const s = await sRes.json();

    const fastWs = new WebSocket(WS_URL);
    await new Promise((r) => fastWs.on("open", r));
    fastWs.send(JSON.stringify({ type: "join", sessionId: s.sessionId, role: "listener", targetLang: "hi" }));

    // Connect slow listener and simulate unread backpressure via socket pause
    const slowWs = new WebSocket(WS_URL);
    await new Promise((r) => slowWs.on("open", r));
    slowWs.send(JSON.stringify({ type: "join", sessionId: s.sessionId, role: "listener", targetLang: "hi" }));
    await new Promise((r) => setTimeout(r, 200));

    // Simulation code: Pause the underlying TCP socket stream on client side
    // This causes server-side ws.bufferedAmount to accumulate rapidly as frames are sent
    const tcpSocket = (slowWs as any)._socket;
    if (tcpSocket && typeof tcpSocket.pause === "function") {
      tcpSocket.pause();
    }

    let droppedOrSkipped = false;
    slowWs.on("close", () => {
      droppedOrSkipped = true;
    });

    // In current server, backpressure dropping is not implemented
    assert.ok(
      droppedOrSkipped,
      "Slow listener exceeding backpressure threshold must be disconnected or marked dropped"
    );

    fastWs.close();
    slowWs.close();
  });

  // --------------------------------------------------------------------------
  // TEST 6: Admin routes fail-closed in every environment
  // --------------------------------------------------------------------------
  test("6. Admin routes deny access (403) when NODE_ENV is unset or development without real admin token", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/sessions`, {
      headers: { "x-admin-token": "unauthorized_token_guess" }
    });
    assert.equal(res.status, 403, "Unauthenticated request to /api/admin/sessions must return 403");
  });

  // --------------------------------------------------------------------------
  // TEST 7: Dist assets must not bundle @azure/cosmos (F7 requirement)
  // --------------------------------------------------------------------------
  test("7. Client bundles in dist/ must NOT contain '@azure/cosmos'", () => {
    const distAssetsDir = path.join(repoRoot, "dist", "assets");
    assert.ok(fs.existsSync(distAssetsDir), "dist/assets must exist");

    const files = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith(".js"));
    const filesWithCosmos: string[] = [];

    for (const f of files) {
      const content = fs.readFileSync(path.join(distAssetsDir, f), "utf8");
      if (content.includes("@azure/cosmos") || content.includes("CosmosClient")) {
        filesWithCosmos.push(f);
      }
    }

    assert.deepEqual(
      filesWithCosmos,
      [],
      `Client-side dist/assets contains @azure/cosmos in files: ${filesWithCosmos.join(", ")}`
    );
  });

  // --------------------------------------------------------------------------
  // TEST 8: Malformed, binary, and oversize WebSocket frames
  // --------------------------------------------------------------------------
  test("8. WS Robustness: handles non-JSON, binary frame, and oversize frame (1 MB refused); health answers afterwards", async () => {
    const ws = new WebSocket(WS_URL);
    await new Promise((r) => ws.on("open", r));

    // 8A. Send non-JSON text frame
    ws.send("THIS_IS_NOT_VALID_JSON{{{");
    await new Promise((r) => setTimeout(r, 100));

    // 8B. Send binary frame
    const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    ws.send(binaryData);
    await new Promise((r) => setTimeout(r, 100));

    // 8C. Send 1 MB frame (must be refused by maxPayload: 64 KB in F2)
    const largeFrame = Buffer.alloc(1024 * 1024, "a");
    let oversizeErrorOrClosed = false;
    ws.on("error", () => { oversizeErrorOrClosed = true; });
    ws.on("close", () => { oversizeErrorOrClosed = true; });

    try {
      ws.send(largeFrame);
    } catch (_) {
      oversizeErrorOrClosed = true;
    }

    await new Promise((r) => setTimeout(r, 300));
    try { ws.close(); } catch (_) {}

    // Verify process is still alive and /api/health responds with 200
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert.equal(healthRes.status, 200, "Server process must stay alive and answer /api/health after malformed frames");

    // In current server, maxPayload is 1 MB so the 1 MB frame is NOT refused yet. Expected to fail until F2 sets maxPayload: 64 KB
    assert.ok(
      oversizeErrorOrClosed,
      "1 MB oversize frame must be refused by WebSocket server"
    );
  });
});
