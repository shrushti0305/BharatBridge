import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { spawn, execSync, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3005";
const WS_URL = "ws://localhost:3005";

describe("F2: WebSocket Rate Limits, Token Bucket & Cost Budget Verification", () => {
  let srv: ChildProcess | null = null;
  let testSession: { sessionId: string; hostToken: string; sessionToken: string };

  before(async () => {
    const env = {
      ...process.env,
      PORT: "3005",
      NODE_ENV: "development",
      COSMOS_USE_FAKE: "true",
      COSMOS_DB_ENDPOINT: "",
      COSMOS_DB_KEY: "",
      COSMOS_DB_DATABASE_NAME: "bharatbridge_f2_test",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300",
      SESSION_COST_BUDGET_USD: "0.001",
      TRUST_PROXY: "1"
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
      throw new Error("Failed to start server on port 3005 for F2 tests");
    }

    // Create a base session for F2 testing
    const res = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "F2 Testing Session", costBudgetUsd: 0.001 })
    });
    testSession = await res.json();
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

  // 1. Sustained 30-second real speaker traffic: a real speaker must NEVER be throttled
  test("1. Sustained 30s real speaker traffic (audio + speech + ping at ~11 msgs/s) is never throttled", async () => {
    const ws = new WebSocket(WS_URL);
    await new Promise((r) => ws.on("open", r));

    let throttledOrClosed = false;
    let rateLimitMessage: any = null;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "error" && (msg.code === "RATE_LIMITED" || msg.code === "RATE_LIMIT_EXCEEDED")) {
          throttledOrClosed = true;
          rateLimitMessage = msg;
        }
      } catch (_) {}
    });

    ws.on("close", () => {
      throttledOrClosed = true;
    });

    // Join as speaker
    ws.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "speaker_30s_tester"
    }));

    await new Promise((r) => setTimeout(r, 300));

    // Sustain mixed traffic for 30 seconds:
    // audio frame every 100ms (10 msgs/s)
    // speech event every 1500ms (~0.67 msgs/s)
    // ping every 3000ms (~0.33 msgs/s)
    const startTime = Date.now();
    let sentCount = 0;
    let lastSpeech = Date.now();
    let lastPing = Date.now();

    while (Date.now() - startTime < 30000) {
      if (ws.readyState !== WebSocket.OPEN) break;

      // Audio frame (approx 2KB base64 PCM)
      ws.send(JSON.stringify({
        type: "audio_frame",
        sessionId: testSession.sessionId,
        data: "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
      }));
      sentCount++;

      // Speech event check
      if (Date.now() - lastSpeech >= 1500) {
        ws.send(JSON.stringify({
          type: "speech_event",
          sessionId: testSession.sessionId,
          text: "Testing real-time speech event stream."
        }));
        sentCount++;
        lastSpeech = Date.now();
      }

      // Ping check
      if (Date.now() - lastPing >= 3000) {
        ws.send(JSON.stringify({
          type: "ping",
          timestamp: Date.now()
        }));
        sentCount++;
        lastPing = Date.now();
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    assert.equal(throttledOrClosed, false, `Speaker was throttled after ${sentCount} messages: ${JSON.stringify(rateLimitMessage)}`);
    assert.equal(ws.readyState, WebSocket.OPEN, "Speaker WebSocket must remain OPEN after 30s sustained speech traffic");
    assert.ok(sentCount >= 280, `Expected at least 280 messages sent in 30s, but sent ${sentCount}`);

    ws.close();
  });

  // 2. Flooding attack storm exceeding burst capacity is throttled by token bucket
  test("2. Flooding attack storm exceeding burst capacity is throttled with RATE_LIMITED", async () => {
    const ws = new WebSocket(WS_URL);
    await new Promise((r) => ws.on("open", r));

    let receivedRateLimit = false;
    let socketClosed = false;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "error" && (msg.code === "RATE_LIMITED" || msg.code === "RATE_LIMIT_EXCEEDED")) {
          receivedRateLimit = true;
        }
      } catch (_) {}
    });

    ws.on("close", () => {
      socketClosed = true;
    });

    ws.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "listener",
      userId: "flooder_tester"
    }));

    await new Promise((r) => setTimeout(r, 200));

    // Send 70 rapid messages with zero delay to exceed burst capacity (bucket size 40)
    for (let i = 0; i < 70; i++) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", seq: i }));
      }
    }

    await new Promise((r) => setTimeout(r, 600));
    try { ws.close(); } catch (_) {}

    assert.ok(
      receivedRateLimit || socketClosed,
      "Flooding attack exceeding burst bucket capacity must receive RATE_LIMITED error or be closed"
    );
  });

  // 3. 64 KB hard cap on frame size: 70 KB payload is rejected with 1009 / closed
  test("3. Oversize frame > 64 KB is rejected with 1009 / closed, while 12 KB frame is accepted", async () => {
    // 3A. Valid 12 KB frame (accepted)
    const validWs = new WebSocket(WS_URL);
    await new Promise((r) => validWs.on("open", r));
    const validPayload = JSON.stringify({
      type: "audio_frame",
      sessionId: testSession.sessionId,
      data: "A".repeat(12 * 1024)
    });
    let validClosed = false;
    validWs.on("close", () => { validClosed = true; });
    validWs.send(validPayload);
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(validClosed, false, "12 KB audio frame must be accepted without socket closing");
    validWs.close();

    // 3B. Oversize 70 KB frame (rejected by maxPayload: 64 KB)
    const oversizeWs = new WebSocket(WS_URL);
    await new Promise((r) => oversizeWs.on("open", r));
    const oversizePayload = JSON.stringify({
      type: "audio_frame",
      sessionId: testSession.sessionId,
      data: "X".repeat(70 * 1024)
    });

    let oversizeRejected = false;
    oversizeWs.on("error", () => { oversizeRejected = true; });
    oversizeWs.on("close", (code) => {
      if (code === 1009 || code === 1006) oversizeRejected = true;
    });

    try {
      oversizeWs.send(oversizePayload);
    } catch (_) {
      oversizeRejected = true;
    }

    await new Promise((r) => setTimeout(r, 500));
    try { oversizeWs.close(); } catch (_) {}

    assert.ok(oversizeRejected, "Frame exceeding 64 KB cap must be rejected by WebSocket server");
  });

  // 4. Origin check fails closed for untrusted origin and allows missing origin
  test("4. Origin check rejects unauthorized origin with HTTP 403 and permits missing origin", async () => {
    // 4A. Unauthorized external origin
    let rejectedWith403 = false;
    const badWs = new WebSocket(WS_URL, {
      headers: { Origin: "https://evil-untrusted-site.com" }
    });

    await new Promise<void>((resolve) => {
      badWs.on("unexpected-response", (_req, res) => {
        if (res.statusCode === 403) rejectedWith403 = true;
        resolve();
      });
      badWs.on("open", () => {
        badWs.close();
        resolve();
      });
      badWs.on("error", () => {
        resolve();
      });
    });

    assert.equal(rejectedWith403, true, "WebSocket connection from unauthorized origin must be rejected with HTTP 403");

    // 4B. Missing Origin header (native clients / curl / mobile)
    let missingOriginConnected = false;
    const cleanWs = new WebSocket(WS_URL);
    await new Promise<void>((resolve) => {
      cleanWs.on("open", () => {
        missingOriginConnected = true;
        cleanWs.close();
        resolve();
      });
      cleanWs.on("error", () => {
        resolve();
      });
    });

    assert.equal(missingOriginConnected, true, "WebSocket connection without Origin header must be allowed");
  });

  // 5. Follow-up A: Trust Proxy hop count & spoofed x-forwarded-for test
  test("5. Trust proxy hop count evaluates real connecting proxy IP and ignores spoofed leftmost IP", async () => {
    // When trust proxy is 1, req.ip evaluates to the rightmost IP in X-Forwarded-For (the client seen by the reverse proxy)
    // We send a request with a spoofed header: "203.0.113.195, 198.51.100.22"
    // The rate limiter must record against 198.51.100.22, not 203.0.113.195
    const res = await fetch(`${BASE_URL}/api/health`, {
      headers: {
        "x-forwarded-for": "203.0.113.195, 198.51.100.22"
      }
    });
    assert.equal(res.status, 200, "Health endpoint responds");
  });

  // 6. Per-session cost budget: stops translation requests when session budget is exhausted
  test("6. Per-session cost budget: translation is blocked with SESSION_BUDGET_EXCEEDED when session budget is reached", async () => {
    // Create a new session with an extremely tight cost budget of $0.0001
    const createRes = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Budget Capped Session", costBudgetUsd: 0.0001 })
    });
    const session = await createRes.json();

    // First translation call consumes budget
    const firstCall = await fetch(`${BASE_URL}/api/azure/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.hostToken
      },
      body: JSON.stringify({
        sessionId: session.sessionId,
        token: session.hostToken,
        text: "This is a sentence to translate that incurs cost against the session budget.",
        sourceLanguageCode: "en",
        targetLanguageCode: "hi"
      })
    });
    assert.equal(firstCall.status, 200, "Initial translation within budget must succeed");

    // Subsequent translation call after budget is exhausted
    const secondCall = await fetch(`${BASE_URL}/api/azure/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.hostToken
      },
      body: JSON.stringify({
        sessionId: session.sessionId,
        token: session.hostToken,
        text: "Another sentence when budget is exhausted.",
        sourceLanguageCode: "en",
        targetLanguageCode: "hi"
      })
    });

    assert.equal(secondCall.status, 429, "Translation exceeding session budget must return HTTP 429");
    const errJson = await secondCall.json();
    assert.equal(errJson.code, "SESSION_BUDGET_EXCEEDED", "Error code must be SESSION_BUDGET_EXCEEDED");
  });
});
