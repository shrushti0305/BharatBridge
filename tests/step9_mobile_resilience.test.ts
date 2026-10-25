import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn, execSync, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3009";
const WS_URL = "ws://localhost:3009";

describe("Step 9: Mobile Network Resilience, SSE Fallback & Long-Lived Auth", () => {
  let srv: ChildProcess | null = null;

  async function createTestSession(name: string) {
    const res = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    return await res.json() as { sessionId: string; hostToken: string; sessionToken: string };
  }

  before(async () => {
    const env = {
      ...process.env,
      PORT: "3009",
      NODE_ENV: "development",
      COSMOS_USE_FAKE: "true",
      COSMOS_DB_ENDPOINT: "",
      COSMOS_DB_KEY: "",
      COSMOS_DB_DATABASE_NAME: "bharatbridge_step9_test",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300",
      TRUST_PROXY: "1"
    };

    srv = spawn("npx", ["tsx", "server.ts"], {
      cwd: repoRoot,
      env,
      shell: true
    });

    let srvLogs = "";
    if (srv.stdout) srv.stdout.on("data", (d) => { srvLogs += d.toString(); });
    if (srv.stderr) srv.stderr.on("data", (d) => { srvLogs += d.toString(); });

    const startWait = Date.now();
    let healthOk = false;
    while (!healthOk && Date.now() - startWait < 30000) {
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (res.ok) {
          healthOk = true;
          break;
        }
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!healthOk) {
      if (process.platform === "win32" && srv.pid) {
        try { execSync(`taskkill /pid ${srv.pid} /t /f`, { stdio: "ignore" }); } catch (_) {}
      }
      throw new Error(`Failed to start server on port 3009 for Step 9 tests. Server output:\n${srvLogs}`);
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

  // 1. Sequence Number Resume on Reconnect
  test("1. Sequence Number Resume: Reconnecting listener with lastSequenceNumber receives only unreceived messages", async () => {
    const session = await createTestSession("Sequence Resume Room");

    // Host connects and emits 3 sequential speech events
    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "organizer",
      hostToken: session.hostToken,
      userId: "host_seq_test"
    }));
    await new Promise((r) => setTimeout(r, 300));

    // Emit 3 speech events with sequence numbers 1, 2, 3
    for (let seq = 1; seq <= 3; seq++) {
      hostWs.send(JSON.stringify({
        type: "speech_event",
        sessionId: session.sessionId,
        eventId: `event-seq-${seq}`,
        sequenceNumber: seq,
        sourceText: `Sentence number ${seq}.`,
        sourceLanguage: "en",
        speakerId: "speaker-01",
        speakerName: "Host"
      }));
      await new Promise((r) => setTimeout(r, 300));
    }

    // Now a reconnecting listener connects specifying lastSequenceNumber: 2
    const listenerWs = new WebSocket(WS_URL);
    await new Promise((r) => listenerWs.on("open", r));

    const receivedHistory: any[] = [];
    listenerWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "history" && Array.isArray(msg.messages)) {
          receivedHistory.push(...msg.messages);
        }
      } catch (_) {}
    });

    listenerWs.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "listener",
      targetLang: "hi",
      userId: "reconnecting_listener",
      lastSequenceNumber: 2
    }));

    const waitStart = Date.now();
    while (receivedHistory.length === 0 && Date.now() - waitStart < 3000) {
      await new Promise((r) => setTimeout(r, 150));
    }

    hostWs.close();
    listenerWs.close();

    // The listener should have received ONLY messages with sequenceNumber > 2 (i.e. sequence 3)
    assert.ok(receivedHistory.length > 0, "Must receive history on resume");
    for (const msg of receivedHistory) {
      assert.ok(
        (msg.sequenceNumber || 0) > 2,
        `All received messages must have sequenceNumber > 2 (received: ${msg.sequenceNumber})`
      );
    }
  });

  // 2. Server-Sent Events (SSE) Fallback Stream for Captions
  test("2. SSE Fallback: GET /api/sessions/:id/captions/stream streams live captions over text/event-stream", async () => {
    const session = await createTestSession("SSE Stream Room");

    // Connect to SSE endpoint via fetch with keepalive/stream
    const controller = new AbortController();
    const sseRes = await fetch(`${BASE_URL}/api/sessions/${session.sessionId}/captions/stream?lang=hi`, {
      headers: { "Accept": "text/event-stream" },
      signal: controller.signal
    });

    assert.equal(sseRes.ok, true, "SSE endpoint must return HTTP 200");
    assert.ok(
      sseRes.headers.get("content-type")?.includes("text/event-stream"),
      "Response Content-Type must be text/event-stream"
    );

    // Host connects and emits speech event
    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "organizer",
      hostToken: session.hostToken,
      userId: "sse_host"
    }));
    await new Promise((r) => setTimeout(r, 300));

    hostWs.send(JSON.stringify({
      type: "speech_event",
      sessionId: session.sessionId,
      eventId: "sse-speech-test-1",
      sequenceNumber: 1,
      sourceText: "Live captions via SSE fallback stream.",
      sourceLanguage: "en",
      speakerId: "speaker-01",
      speakerName: "Host"
    }));

    // Read SSE body stream until we receive the caption event
    const reader = sseRes.body?.getReader();
    assert.ok(reader, "SSE response body must be readable stream");

    let receivedSseData = "";
    const readStart = Date.now();
    while (Date.now() - readStart < 5000) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = new TextDecoder().decode(value);
      receivedSseData += text;
      if (receivedSseData.includes("sse-speech-test-1")) {
        break;
      }
    }

    controller.abort();
    hostWs.close();

    assert.ok(
      receivedSseData.includes("sse-speech-test-1"),
      `SSE stream must deliver live transcription event. Received stream chunks:\n${receivedSseData}`
    );
  });

  // 3. Silent Token Refresh
  test("3. Silent Token Refresh: POST /api/sessions/:id/refresh-token extends valid sessionToken by 24h", async () => {
    const session = await createTestSession("Token Refresh Room");

    const refreshRes = await fetch(`${BASE_URL}/api/sessions/${session.sessionId}/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: session.sessionToken
      })
    });

    assert.equal(refreshRes.ok, true, "Refresh endpoint must return HTTP 200 for valid token");
    const refreshData = await refreshRes.json();
    assert.equal(refreshData.ok, true);
    assert.ok(typeof refreshData.sessionToken === "string", "Must return refreshed sessionToken");
    assert.ok(refreshData.expiresAt > Date.now() + 12 * 3600 * 1000, "Refreshed token must have > 12h validity");
  });
});
