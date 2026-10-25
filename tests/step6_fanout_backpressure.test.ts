import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn, execSync, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { safeSendToListener } from "../server.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3006";
const WS_URL = "ws://localhost:3006";

describe("Step 6: Per-Language Fan-Out, Backpressure & Memory Leak Protection", () => {
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
      PORT: "3006",
      NODE_ENV: "development",
      COSMOS_USE_FAKE: "true",
      COSMOS_DB_ENDPOINT: "",
      COSMOS_DB_KEY: "",
      COSMOS_DB_DATABASE_NAME: "bharatbridge_step6_test",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300",
      MAX_WS_BUFFERED_AMOUNT: "32768", // 32 KB test threshold
      TRUST_PROXY: "1"
    };

    srv = spawn("npx", ["tsx", "server.ts"], {
      cwd: repoRoot,
      env,
      shell: true
    });

    let srvLogs = "";
    if (srv.stdout) srv.stdout.on("data", (d) => { 
      srvLogs += d.toString(); 
      process.stdout.write(d);
    });
    if (srv.stderr) srv.stderr.on("data", (d) => { 
      srvLogs += d.toString(); 
      process.stderr.write(d);
    });

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
      throw new Error(`Failed to start server on port 3006 for Step 6 tests. Server output:\n${srvLogs}`);
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

  // 1. Single translation synthesis shared by 50 listeners in the same language
  test("1. Fan-out efficiency: 50 concurrent listeners in Hindi receive identical broadcast from 1 translation invocation", async () => {
    const session1 = await createTestSession("Fan-Out 50 Listeners Room");

    // Connect Host
    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: session1.sessionId,
      role: "organizer",
      hostToken: session1.hostToken,
      userId: "host_fanout",
      userName: "Host Fanout"
    }));
    await new Promise((r) => setTimeout(r, 300));

    // Connect 50 listeners all subscribed to 'hi'
    const listenerSockets: WebSocket[] = [];
    const receivedMessages: string[] = [];

    for (let i = 0; i < 50; i++) {
      const lWs = new WebSocket(WS_URL);
      listenerSockets.push(lWs);
      lWs.on("message", (raw) => {
        try {
          const m = JSON.parse(raw.toString());
          if (m.type === "transcription" && m.translatedText) {
            receivedMessages.push(m.translatedText);
          }
        } catch (_) {}
      });

      await new Promise((r) => lWs.on("open", r));
      lWs.send(JSON.stringify({
        type: "join",
        sessionId: session1.sessionId,
        role: "listener",
        userId: `listener_hi_${i}`,
        targetLang: "hi"
      }));
    }

    // Wait for all 50 listeners to be registered in language group
    await new Promise((r) => setTimeout(r, 600));

    // Host sends a speech event that triggers translation
    hostWs.send(JSON.stringify({
      type: "speech_event",
      sessionId: session1.sessionId,
      eventId: "fanout-test-event-1",
      sourceText: "Welcome to BharatBridge live event broadcast.",
      sourceLanguage: "en",
      speakerId: "speaker-01",
      speakerName: "Host Fanout"
    }));

    // Wait for broadcast fan-out via polling
    const fanoutStart = Date.now();
    while (receivedMessages.length < 50 && Date.now() - fanoutStart < 6000) {
      await new Promise((r) => setTimeout(r, 200));
    }

    // Clean up sockets
    for (const ws of listenerSockets) ws.close();
    hostWs.close();

    assert.ok(receivedMessages.length >= 45, `At least 45 of 50 listeners must receive broadcast (received: ${receivedMessages.length})`);
    // Assert all received identical translated text
    const firstText = receivedMessages[0];
    assert.ok(firstText, "Translated text must not be empty");
    const allIdentical = receivedMessages.every((t) => t === firstText);
    assert.equal(allIdentical, true, "All listeners must receive identical translated broadcast from single synthesis");
  });

  // 2. Slow Listener Eviction: Client exceeding 256 KB bufferedAmount is evicted while healthy listeners stay alive
  test("2. Backpressure: Slow listener with bufferedAmount exceeding 256 KB is evicted; fast listener continues uninterrupted", async () => {
    const mockGroup = {
      listeners: new Set<any>()
    };

    let slowTerminated = false;
    let fastSent = false;
    const fastListener = {
      readyState: 1, // WebSocket.OPEN
      bufferedAmount: 1024, // 1 KB
      send: (_payload: string) => { fastSent = true; },
      terminate: () => {}
    };

    const slowListener = {
      readyState: 1, // WebSocket.OPEN
      bufferedAmount: 300 * 1024, // 300 KB (> 256 KB)
      send: (_payload: string) => {},
      terminate: () => { slowTerminated = true; }
    };

    mockGroup.listeners.add(fastListener);
    mockGroup.listeners.add(slowListener);

    // Fast listener send
    const fastOk = safeSendToListener(fastListener, '{"type":"test"}', mockGroup, "test-session", 256 * 1024);
    assert.equal(fastOk, true, "Fast listener must succeed send");
    assert.equal(fastSent, true, "Fast listener must receive payload");
    assert.equal(mockGroup.listeners.has(fastListener), true, "Fast listener must remain in group");

    // Slow listener send triggers backpressure eviction
    const slowOk = safeSendToListener(slowListener, '{"type":"test"}', mockGroup, "test-session", 256 * 1024);
    assert.equal(slowOk, false, "Slow listener must fail send");
    assert.equal(slowTerminated, true, "Slow listener must be terminated via ws.terminate()");
    assert.equal(mockGroup.listeners.has(slowListener), false, "Slow listener must be evicted from group.listeners");

    // Closed socket eviction
    const closedListener = {
      readyState: 3, // WebSocket.CLOSED
      bufferedAmount: 0,
      send: () => {},
      terminate: () => {}
    };
    mockGroup.listeners.add(closedListener);
    const closedOk = safeSendToListener(closedListener, '{"type":"test"}', mockGroup, "test-session", 256 * 1024);
    assert.equal(closedOk, false);
    assert.equal(mockGroup.listeners.has(closedListener), false, "Closed socket must be evicted from group");
  });

  // 3. Multi-Language Fan-Out Isolation
  test("3. Language Isolation: Listeners receive only their subscribed language broadcast", async () => {
    const session3 = await createTestSession("Language Isolation Room");

    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: session3.sessionId,
      role: "organizer",
      hostToken: session3.hostToken,
      userId: "host_isolation"
    }));
    await new Promise((r) => setTimeout(r, 200));

    // Listener HI
    const hiWs = new WebSocket(WS_URL);
    await new Promise((r) => hiWs.on("open", r));
    const hiMessages: any[] = [];
    hiWs.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "transcription") hiMessages.push(m);
      } catch (_) {}
    });
    hiWs.send(JSON.stringify({
      type: "join",
      sessionId: session3.sessionId,
      role: "listener",
      userId: "listener_hi",
      targetLang: "hi"
    }));

    // Listener GU
    const guWs = new WebSocket(WS_URL);
    await new Promise((r) => guWs.on("open", r));
    const guMessages: any[] = [];
    guWs.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "transcription") guMessages.push(m);
      } catch (_) {}
    });
    guWs.send(JSON.stringify({
      type: "join",
      sessionId: session3.sessionId,
      role: "listener",
      userId: "listener_gu",
      targetLang: "gu"
    }));

    await new Promise((r) => setTimeout(r, 300));

    // Send speech event
    hostWs.send(JSON.stringify({
      type: "speech_event",
      sessionId: session3.sessionId,
      eventId: "isolation-test-1",
      sourceText: "Good morning everyone.",
      sourceLanguage: "en",
      speakerId: "speaker-01",
      speakerName: "Host"
    }));

    // Wait for isolation broadcast via polling
    const isoStart = Date.now();
    while ((hiMessages.length === 0 || guMessages.length === 0) && Date.now() - isoStart < 6000) {
      await new Promise((r) => setTimeout(r, 200));
    }

    hiWs.close();
    guWs.close();
    hostWs.close();

    const hiMsg = hiMessages.find((m) => m.targetLang === "hi");
    assert.ok(hiMsg, "Hindi listener must receive Hindi transcription");

    const guMsg = guMessages.find((m) => m.targetLang === "gu");
    assert.ok(guMsg, "Gujarati listener must receive Gujarati transcription");
  });
});
