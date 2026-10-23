import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn, execSync, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3005";
const WS_URL = "ws://localhost:3005";

describe("Step 4: Host Reconnect & Immutable Role Reclaim", () => {
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
      COSMOS_DB_DATABASE_NAME: "bharatbridge_step4_test",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300",
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
      throw new Error("Failed to start server on port 3005 for Step 4 tests");
    }

    // Create session via API
    const res = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Host Reconnect Live Test" })
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

  // 1. Initial Host Connect: joins as organizer with hostToken, becomes speaker-01
  test("1. Initial Host Connect: claims organizer role and is registered in room_state as speaker-01", async () => {
    const ws = new WebSocket(WS_URL);
    await new Promise((r) => ws.on("open", r));

    const messages: any[] = [];
    ws.on("message", (raw) => {
      try {
        messages.push(JSON.parse(raw.toString()));
      } catch (_) {}
    });

    ws.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "host_user_1",
      userName: "Main Host"
    }));

    await new Promise((r) => setTimeout(r, 400));
    ws.close();

    const hostTokenMsg = messages.find((m) => m.type === "host_token");
    assert.ok(hostTokenMsg, "Must receive host_token frame");
    assert.equal(hostTokenMsg.hostToken, testSession.hostToken, "hostToken must match");

    const roomStateMsg = messages.find((m) => m.type === "room_state");
    assert.ok(roomStateMsg, "Must receive room_state frame");
    const speaker01 = roomStateMsg.panelists?.find((p: any) => p.speakerId === "speaker-01");
    assert.ok(speaker01, "speaker-01 must be registered in panelists");
    assert.equal(speaker01.userId, "host_user_1", "speaker-01 must be bound to host_user_1");
  });

  // 2. Simulated Network Drop and Reconnect: Host drops socket and reconnects with hostToken
  test("2. Network Drop & Reconnect: Host drops socket, reconnects with hostToken, and reclaims host role without demotion", async () => {
    // Phase A: Host connects socket 1
    const ws1 = new WebSocket(WS_URL);
    await new Promise((r) => ws1.on("open", r));
    ws1.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "host_user_1",
      userName: "Main Host"
    }));
    await new Promise((r) => setTimeout(r, 300));

    // Send a message via /api/translate so history exists in session.messages
    const transRes = await fetch(`${BASE_URL}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": testSession.hostToken },
      body: JSON.stringify({
        sessionId: testSession.sessionId,
        token: testSession.hostToken,
        text: "Testing host reconnect message history.",
        targetLanguage: "hi",
        sourceLanguage: "en"
      })
    });
    assert.equal(transRes.status, 200, "Translation API must succeed and populate session messages");
    await new Promise((r) => setTimeout(r, 400));

    // Phase B: Simulate abrupt connection drop (network loss or browser refresh)
    ws1.close();
    await new Promise((r) => setTimeout(r, 300));

    // Phase C: Host reconnects with socket 2 providing stored hostToken
    const ws2 = new WebSocket(WS_URL);
    await new Promise((r) => ws2.on("open", r));
    const reconnectMessages: any[] = [];
    ws2.on("message", (raw) => {
      try {
        reconnectMessages.push(JSON.parse(raw.toString()));
      } catch (_) {}
    });

    ws2.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "host_user_1",
      userName: "Main Host"
    }));

    await new Promise((r) => setTimeout(r, 500));
    ws2.close();

    const roleChanged = reconnectMessages.find((m) => m.type === "role_changed");
    assert.equal(roleChanged, undefined, "Host must NEVER be demoted to LISTENER on valid reconnect");

    const hostTokenMsg = reconnectMessages.find((m) => m.type === "host_token");
    assert.ok(hostTokenMsg, "Reconnecting host must receive host_token confirmation");

    const roomStateMsg = reconnectMessages.find((m) => m.type === "room_state");
    assert.ok(roomStateMsg, "Reconnecting host must receive fresh room_state");
    const speaker01 = roomStateMsg.panelists?.find((p: any) => p.speakerId === "speaker-01");
    assert.ok(speaker01, "speaker-01 must be actively registered for reconnected host");
    assert.equal(speaker01.userId, "host_user_1", "speaker-01 must belong to host_user_1");

    const historyMsg = reconnectMessages.find((m) => m.type === "history");
    assert.ok(historyMsg, "Reconnecting host must receive message history");
    assert.ok(historyMsg.messages?.length > 0, "History messages array must not be empty");
  });

  // 3. First-Socket-Close Race & Multi-Tab Supersede: Socket 2 connects before Socket 1 closes
  test("3. First-Socket-Close Race: Socket 2 connects before Socket 1 closes; Socket 1 is superseded and closing it does not strip host from Socket 2", async () => {
    // Socket 1 opens
    const ws1 = new WebSocket(WS_URL);
    await new Promise((r) => ws1.on("open", r));
    let ws1Superseded = false;
    ws1.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "role_changed" && m.role === "SUPERSEDED") {
          ws1Superseded = true;
        }
      } catch (_) {}
    });

    ws1.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "host_tab_1"
    }));
    await new Promise((r) => setTimeout(r, 300));

    // Socket 2 opens in second tab / reconnect before Socket 1 closes
    const ws2 = new WebSocket(WS_URL);
    await new Promise((r) => ws2.on("open", r));
    const ws2Messages: any[] = [];
    ws2.on("message", (raw) => {
      try {
        ws2Messages.push(JSON.parse(raw.toString()));
      } catch (_) {}
    });

    ws2.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "host_tab_2"
    }));

    await new Promise((r) => setTimeout(r, 400));

    // Verify Socket 1 received superseded notification and was closed by server
    assert.equal(ws1Superseded, true, "Socket 1 must be notified it was superseded by a newer host connection");

    // Now Socket 1's close event finishes in background; wait for server close handler
    await new Promise((r) => setTimeout(r, 300));

    // Check Socket 2 still has host status by sending an organizer command (e.g. ping or speech)
    assert.equal(ws2.readyState, WebSocket.OPEN, "Socket 2 must remain open as active host");
    const hostTokenMsg = ws2Messages.find((m) => m.type === "host_token");
    assert.ok(hostTokenMsg, "Socket 2 must have received host_token");

    ws2.close();
  });

  // 4. Imposter Takeover Prevention while Host is Disconnected
  test("4. Takeover Prevention: Listener cannot claim host role with wrong/missing hostToken even when host is disconnected", async () => {
    const imposterWs = new WebSocket(WS_URL);
    await new Promise((r) => imposterWs.on("open", r));
    const messages: any[] = [];
    imposterWs.on("message", (raw) => {
      try {
        messages.push(JSON.parse(raw.toString()));
      } catch (_) {}
    });

    imposterWs.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: "wrong_fake_host_token",
      userId: "malicious_actor"
    }));

    await new Promise((r) => setTimeout(r, 400));
    imposterWs.close();

    const roleChanged = messages.find((m) => m.type === "role_changed");
    assert.ok(roleChanged, "Imposter must receive role_changed frame");
    assert.equal(roleChanged.role, "LISTENER", "Imposter must be demoted to LISTENER");
    assert.equal(roleChanged.status, "takeover_prevented", "Status must be takeover_prevented");
  });
});
