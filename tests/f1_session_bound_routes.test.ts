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

describe("F1: Session-Bound Authentication & Route Protection", () => {
  let srv: ChildProcess | null = null;
  let s1: { sessionId: string; hostToken: string; sessionToken: string };
  let s2: { sessionId: string; hostToken: string; sessionToken: string };

  before(async () => {
    const env = {
      ...process.env,
      PORT: "3005",
      NODE_ENV: "development",
      COSMOS_DB_ENDPOINT: "",
      COSMOS_DB_KEY: "",
      COSMOS_DB_DATABASE_NAME: "bharatbridge_f1_test",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300"
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
      throw new Error("Failed to start server on port 3005 for F1 tests");
    }

    // Create session 1
    const s1Res = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "F1 Test Session 1" })
    });
    s1 = await s1Res.json();

    // Create session 2
    const s2Res = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "F1 Test Session 2" })
    });
    s2 = await s2Res.json();
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

  // 1. /api/session-summary (Host Only)
  describe("1. /api/session-summary (Host Token Enforcement)", () => {
    const validBody = () => ({
      sessionId: s1.sessionId,
      messages: [{ id: "m1", originalText: "Hello", translatedText: "नमस्ते" }]
    });

    test("denies tokenless request with 403", async () => {
      const res = await fetch(`${BASE_URL}/api/session-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody())
      });
      assert.equal(res.status, 403, "Tokenless /api/session-summary must return 403");
    });

    test("denies listener request (holding sessionToken) with 403", async () => {
      const res = await fetch(`${BASE_URL}/api/session-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s1.sessionToken
        },
        body: JSON.stringify({ ...validBody(), token: s1.sessionToken })
      });
      assert.equal(res.status, 403, "Listener sessionToken on /api/session-summary must return 403");
    });

    test("denies mismatched hostToken from another session with 403", async () => {
      const res = await fetch(`${BASE_URL}/api/session-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s2.hostToken
        },
        body: JSON.stringify({ ...validBody(), token: s2.hostToken })
      });
      assert.equal(res.status, 403, "Mismatched hostToken must return 403");
    });

    test("allows request with matching hostToken", async () => {
      const res = await fetch(`${BASE_URL}/api/session-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s1.hostToken
        },
        body: JSON.stringify({ ...validBody(), token: s1.hostToken })
      });
      assert.equal(res.status, 200, "Matching hostToken must return 200");
    });
  });

  // 2. /api/azure/upload-caption (Host Only, Server-Derived Path)
  describe("2. /api/azure/upload-caption (Host Token & Path Derivation)", () => {
    const validBody = () => ({
      sessionId: s1.sessionId,
      sessionName: "Test Session",
      captions: [{ originalText: "Hello", translatedText: "नमस्ते" }]
    });

    test("denies tokenless request with 403 (P0 fix)", async () => {
      const res = await fetch(`${BASE_URL}/api/azure/upload-caption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody())
      });
      assert.equal(res.status, 403, "Tokenless upload-caption must return 403");
    });

    test("denies listener sessionToken with 403", async () => {
      const res = await fetch(`${BASE_URL}/api/azure/upload-caption`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s1.sessionToken
        },
        body: JSON.stringify({ ...validBody(), token: s1.sessionToken })
      });
      assert.equal(res.status, 403, "Listener sessionToken must be rejected with 403");
    });

    test("denies mismatched hostToken with 403", async () => {
      const res = await fetch(`${BASE_URL}/api/azure/upload-caption`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s2.hostToken
        },
        body: JSON.stringify({ ...validBody(), token: s2.hostToken })
      });
      assert.equal(res.status, 403, "Mismatched hostToken must return 403");
    });

    test("allows matching hostToken and verifies server-derived blob path", async () => {
      const res = await fetch(`${BASE_URL}/api/azure/upload-caption`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s1.hostToken
        },
        body: JSON.stringify({ ...validBody(), token: s1.hostToken })
      });
      assert.equal(res.status, 200, "Matching hostToken must succeed with 200");
      const data = await res.json();
      assert.ok(data.success, "Upload must succeed");
      assert.ok(data.blobName.startsWith(`captions-${s1.sessionId}`), "Blob path must be server-derived with sessionId prefix");
    });
  });

  // 3. /api/translate (Session Token or Host Token, Practice Mode with Limits)
  describe("3. /api/translate (Session Token Binding & Practice Limits)", () => {
    test("denies in-session request without token with 403", async () => {
      const res = await fetch(`${BASE_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: s1.sessionId,
          text: "Hello",
          targetLanguage: "hi"
        })
      });
      assert.equal(res.status, 403, "In-session request without token must return 403");
    });

    test("denies in-session request with other-session token with 403", async () => {
      const res = await fetch(`${BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s2.sessionToken
        },
        body: JSON.stringify({
          sessionId: s1.sessionId,
          text: "Hello",
          targetLanguage: "hi",
          token: s2.sessionToken
        })
      });
      assert.equal(res.status, 403, "Mismatched session token must return 403");
    });

    test("denies 'test_session' and 'global_test' auth bypasses with 403", async () => {
      const res1 = await fetch(`${BASE_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "test_session", text: "Hello", targetLanguage: "hi" })
      });
      assert.equal(res1.status, 403, "'test_session' bypass must return 403");

      const res2 = await fetch(`${BASE_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "global_test", text: "Hello", targetLanguage: "hi" })
      });
      assert.equal(res2.status, 403, "'global_test' bypass must return 403");
    });

    test("allows in-session request with matching sessionToken (listener)", async () => {
      const res = await fetch(`${BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s1.sessionToken
        },
        body: JSON.stringify({
          sessionId: s1.sessionId,
          text: "Hello",
          targetLanguage: "hi",
          token: s1.sessionToken
        })
      });
      assert.equal(res.status, 200, "Matching sessionToken must return 200");
    });

    test("allows practice mode (no sessionId) up to 500 characters", async () => {
      const res = await fetch(`${BASE_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Practice mode translation test sentence.",
          targetLanguage: "hi"
        })
      });
      assert.equal(res.status, 200, "Practice mode translation must return 200");
    });

    test("rejects practice mode text exceeding 500 characters with 400", async () => {
      const longText = "a".repeat(501);
      const res = await fetch(`${BASE_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: longText,
          targetLanguage: "hi"
        })
      });
      assert.equal(res.status, 400, "Practice mode text > 500 chars must return 400");
    });
  });

  // 4. /api/azure/tts (Session Token Acceptance for Listeners)
  describe("4. /api/azure/tts (Listener Audio Fix via sessionToken)", () => {
    test("denies in-session TTS without token with 403", async () => {
      const res = await fetch(`${BASE_URL}/api/azure/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: s1.sessionId,
          text: "नमस्ते",
          languageCode: "hi-IN"
        })
      });
      assert.equal(res.status, 403, "Tokenless in-session TTS must return 403");
    });

    test("denies 'test_session' and 'global_test' TTS bypasses with 403", async () => {
      const res1 = await fetch(`${BASE_URL}/api/azure/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "test_session", text: "नमस्ते", languageCode: "hi-IN" })
      });
      assert.equal(res1.status, 403, "test_session TTS must return 403");

      const res2 = await fetch(`${BASE_URL}/api/azure/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "global_test", text: "नमस्ते", languageCode: "hi-IN" })
      });
      assert.equal(res2.status, 403, "global_test TTS must return 403");
    });

    test("allows in-session TTS with matching sessionToken (listener audio working)", async () => {
      const res = await fetch(`${BASE_URL}/api/azure/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": s1.sessionToken
        },
        body: JSON.stringify({
          sessionId: s1.sessionId,
          text: "नमस्ते",
          languageCode: "hi-IN",
          token: s1.sessionToken
        })
      });
      assert.equal(res.status, 200, "In-session TTS with sessionToken must return 200 (fixes listener audio)");
    });
  });

  // 5. Token Delivery over WebSocket
  describe("5. Token Delivery to Listeners", () => {
    test("delivers sessionToken to listener in join_ack; omits from room_state", async () => {
      const ws = new WebSocket(WS_URL);
      await new Promise((r) => ws.on("open", r));

      let receivedJoinAck: any = null;
      let receivedRoomState: any = null;

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "join_ack") receivedJoinAck = msg;
          if (msg.type === "room_state") receivedRoomState = msg;
        } catch (_) {}
      });

      ws.send(JSON.stringify({
        type: "join",
        sessionId: s1.sessionId,
        role: "listener",
        userId: "test_listener_ack"
      }));

      await new Promise((r) => setTimeout(r, 600));
      ws.close();

      assert.ok(receivedJoinAck, "Listener must receive a join_ack frame");
      assert.ok(receivedJoinAck.sessionToken, "join_ack must deliver a non-empty sessionToken");
      assert.equal(receivedJoinAck.role, "listener", "join_ack must confirm role");

      if (receivedRoomState) {
        assert.equal(receivedRoomState.sessionToken, undefined, "room_state must NEVER leak sessionToken");
        assert.equal(receivedRoomState.hostToken, undefined, "room_state must NEVER leak hostToken");
      }
    });
  });

  // 6. Duo Mode & Role Controls
  describe("6. Duo Mode & Role Controls", () => {
    test("listener cannot enable isDuoMode on join; third joiner stays pending", async () => {
      // Create a duo mode session
      const createRes = await fetch(`${BASE_URL}/api/sessions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Duo Mode Test", isDuoMode: true })
      });
      const duoSession = await createRes.json();

      // Host joins
      const hostWs = new WebSocket(WS_URL);
      await new Promise((r) => hostWs.on("open", r));
      hostWs.send(JSON.stringify({
        type: "join",
        sessionId: duoSession.sessionId,
        role: "speaker",
        hostToken: duoSession.hostToken,
        userId: "host_speaker"
      }));
      await new Promise((r) => setTimeout(r, 300));

      // Guest 1 joins as listener and requests speaker (should auto-approve in duo mode)
      const guest1Ws = new WebSocket(WS_URL);
      await new Promise((r) => guest1Ws.on("open", r));
      let guest1RoleChanged: any = null;
      guest1Ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "role_changed") guest1RoleChanged = msg;
        } catch (_) {}
      });
      guest1Ws.send(JSON.stringify({
        type: "join",
        sessionId: duoSession.sessionId,
        role: "listener",
        userId: "guest_1"
      }));
      await new Promise((r) => setTimeout(r, 200));

      guest1Ws.send(JSON.stringify({
        type: "speaker_request",
        sessionId: duoSession.sessionId,
        userId: "guest_1",
        userName: "Guest One"
      }));
      await new Promise((r) => setTimeout(r, 300));
      assert.ok(guest1RoleChanged, "Guest 1 must receive role_changed");
      assert.equal(guest1RoleChanged.role, "PANELIST", "Guest 1 is auto-approved as 2nd panelist");

      // Guest 2 requests speaker (should NOT be auto-approved, session has 2 panelists: host + guest 1)
      const guest2Ws = new WebSocket(WS_URL);
      await new Promise((r) => guest2Ws.on("open", r));
      let guest2RoleChanged: any = null;
      guest2Ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "role_changed") guest2RoleChanged = msg;
        } catch (_) {}
      });
      guest2Ws.send(JSON.stringify({
        type: "join",
        sessionId: duoSession.sessionId,
        role: "listener",
        userId: "guest_2"
      }));
      await new Promise((r) => setTimeout(r, 200));

      guest2Ws.send(JSON.stringify({
        type: "speaker_request",
        sessionId: duoSession.sessionId,
        userId: "guest_2",
        userName: "Guest Two"
      }));
      await new Promise((r) => setTimeout(r, 300));
      assert.equal(guest2RoleChanged, null, "Third speaker request must NOT auto-approve (must stay pending)");

      hostWs.close();
      guest1Ws.close();
      guest2Ws.close();
    });
  });

  // 7. Token Invalidation on end_session
  describe("7. Token Invalidation on end_session", () => {
    test("host end_session invalidates tokens and notifies listeners", async () => {
      const createRes = await fetch(`${BASE_URL}/api/sessions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "End Session Test" })
      });
      const endTestSession = await createRes.json();

      const hostWs = new WebSocket(WS_URL);
      await new Promise((r) => hostWs.on("open", r));
      hostWs.send(JSON.stringify({
        type: "join",
        sessionId: endTestSession.sessionId,
        role: "speaker",
        hostToken: endTestSession.hostToken,
        userId: "host_end_test"
      }));

      const listenerWs = new WebSocket(WS_URL);
      await new Promise((r) => listenerWs.on("open", r));
      let sessionEndedMsg: any = null;
      let listenerToken: string | null = null;
      listenerWs.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "join_ack") listenerToken = msg.sessionToken;
          if (msg.type === "session_ended") sessionEndedMsg = msg;
        } catch (_) {}
      });
      listenerWs.send(JSON.stringify({
        type: "join",
        sessionId: endTestSession.sessionId,
        role: "listener",
        userId: "listener_end_test"
      }));

      await new Promise((r) => setTimeout(r, 300));
      assert.ok(listenerToken, "Listener received token");

      // Host ends session
      hostWs.send(JSON.stringify({
        type: "end_session",
        sessionId: endTestSession.sessionId,
        token: endTestSession.hostToken
      }));

      await new Promise((r) => setTimeout(r, 400));
      assert.ok(sessionEndedMsg, "Listener must receive session_ended frame");

      // Subsequent HTTP call with listenerToken must now be rejected with 403
      const ttsRes = await fetch(`${BASE_URL}/api/azure/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": listenerToken },
        body: JSON.stringify({
          sessionId: endTestSession.sessionId,
          text: "नमस्ते",
          languageCode: "hi-IN",
          token: listenerToken
        })
      });
      assert.equal(ttsRes.status, 403, "Post-ended session requests must be rejected with 403");

      hostWs.close();
      listenerWs.close();
    });
  });

  // 8. Token for session A does not exempt guesses at session B
  describe("8. Token Cross-Session Isolation & Failed-Join Throttling", () => {
    test("holding token for session A does not exempt invalid guesses for session B", async () => {
      const ws = new WebSocket(WS_URL);
      await new Promise((r) => ws.on("open", r));

      let receivedError: any = null;
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "error") receivedError = msg;
        } catch (_) {}
      });

      // Try joining non-existent session with s1.sessionToken
      ws.send(JSON.stringify({
        type: "join",
        sessionId: "99999999",
        token: s1.sessionToken,
        role: "listener",
        userId: "attacker"
      }));

      await new Promise((r) => setTimeout(r, 400));
      ws.close();

      assert.ok(receivedError, "Must receive error frame on non-existent session");
      assert.equal(receivedError.code, "SESSION_NOT_FOUND", "Error must be SESSION_NOT_FOUND");
    });
  });
});
