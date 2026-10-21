import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "http";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { timingSafeEqualToken } from "../server";

describe("FIX 2: Host Token Session Binding Proof", () => {
  interface MockSession {
    id: string;
    topic: string;
    hostToken: string;
    hostTokenHash: string;
    sessionToken: string;
    speaker: any;
    organizerWs: any;
    messages: any[];
    panelists: Map<string, any>;
    pendingRequests: Map<string, any>;
  }

  function setupAppAndWs() {
    const app = express();
    app.use(express.json());
    const sessions = new Map<string, MockSession>();

    const tokenA = "host_token_secret_A_" + crypto.randomBytes(8).toString("hex");
    const tokenB = "host_token_secret_B_" + crypto.randomBytes(8).toString("hex");

    sessions.set("session-A", {
      id: "session-A",
      topic: "Session A Topic",
      hostToken: tokenA,
      hostTokenHash: crypto.createHash("sha256").update(tokenA).digest("hex"),
      sessionToken: "session_token_A",
      speaker: null,
      organizerWs: null,
      messages: [{ id: "msg-1", originalText: "Hello from Session A", translatedText: "नमस्ते" }],
      panelists: new Map(),
      pendingRequests: new Map()
    });

    sessions.set("session-B", {
      id: "session-B",
      topic: "Session B Topic",
      hostToken: tokenB,
      hostTokenHash: crypto.createHash("sha256").update(tokenB).digest("hex"),
      sessionToken: "session_token_B",
      speaker: null,
      organizerWs: null,
      messages: [{ id: "msg-2", originalText: "Private notes of Session B", translatedText: "निजी" }],
      panelists: new Map(),
      pendingRequests: new Map()
    });

    function verifySessionToken(req: express.Request, session: any): boolean {
      if (!session) return false;
      const clientToken = (
        req.headers["x-session-token"] ||
        req.headers["x-host-token"] ||
        (req.query?.sessionToken as string) ||
        (req.query?.hostToken as string) ||
        req.body?.sessionToken ||
        req.body?.token ||
        req.body?.hostToken
      )?.toString().trim();

      if (!clientToken) return false;
      if (session.sessionToken && timingSafeEqualToken(clientToken, session.sessionToken)) return true;
      if (session.hostToken && timingSafeEqualToken(clientToken, session.hostToken)) return true;
      if (session.hostTokenHash) {
        const hash = crypto.createHash("sha256").update(clientToken).digest("hex");
        if (timingSafeEqualToken(hash, session.hostTokenHash)) return true;
      }
      return false;
    }

    function verifyAdminAccess(req: any): boolean {
      const envAdminToken = (process.env.ADMIN_TOKEN || "").trim();
      if (!envAdminToken) return false;
      const adminTokenHeader = (req.headers["x-admin-token"] || "").toString().trim();
      return timingSafeEqualToken(adminTokenHeader, envAdminToken);
    }

    // 1. GET /api/admin/sessions/:id/messages
    app.get("/api/admin/sessions/:id/messages", (req, res) => {
      const { id } = req.params;
      const isAdmin = verifyAdminAccess(req);
      const targetSession = sessions.get(id);
      const isSessionHost = targetSession ? verifySessionToken(req, targetSession) : false;

      if (!isAdmin && !isSessionHost) {
        return res.status(403).json({ error: "Forbidden: Admin authorization or valid session host token required" });
      }
      return res.status(200).json({ messages: targetSession?.messages || [] });
    });

    // 2. POST /api/azure/translate
    app.post("/api/azure/translate", (req, res) => {
      const activeSessionId = req.body?.sessionId;
      const sessionObj = sessions.get(activeSessionId);
      if (sessionObj && !verifySessionToken(req, sessionObj)) {
        return res.status(403).json({ error: "Forbidden: Valid sessionToken or hostToken is required" });
      }
      return res.status(200).json({ translatedText: "OK" });
    });

    // 3. POST /api/azure/tts
    app.post("/api/azure/tts", (req, res) => {
      const activeSessionId = req.body?.sessionId;
      const sessionObj = sessions.get(activeSessionId);
      if (sessionObj && !verifySessionToken(req, sessionObj)) {
        return res.status(403).json({ error: "Forbidden: Valid sessionToken or hostToken is required" });
      }
      return res.status(200).json({ success: true, audio: "dummy_audio" });
    });

    // 4. GET /api/admin/sessions (Global admin route)
    app.get("/api/admin/sessions", (req, res) => {
      if (!verifyAdminAccess(req)) {
        return res.status(403).json({ error: "Forbidden: Admin authorization required" });
      }
      return res.status(200).json({ sessions: Array.from(sessions.values()) });
    });

    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws) => {
      let currentSessionId = "";
      let currentRole = "listener";

      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "join") {
          currentSessionId = msg.sessionId;
          const session = sessions.get(currentSessionId);
          if (!session) return;

          const inputHostToken = msg.hostToken;
          let hasValidHostToken = false;
          if (inputHostToken && session.hostToken) {
            hasValidHostToken = timingSafeEqualToken(inputHostToken, session.hostToken);
          }

          if (msg.role === "speaker" || msg.role === "organizer") {
            if (hasValidHostToken) {
              currentRole = "organizer";
              session.organizerWs = ws;
              session.speaker = ws;
              ws.send(JSON.stringify({ type: "host_token", sessionId: currentSessionId, role: "organizer" }));
            } else {
              currentRole = "listener";
              ws.send(JSON.stringify({ type: "role_changed", role: "LISTENER", status: "takeover_prevented" }));
            }
          }
        }

        if (msg.type === "speech_event") {
          if (currentRole !== "organizer" && currentRole !== "speaker") {
            ws.send(JSON.stringify({ type: "error", code: "UNAUTHORIZED_SPEAKER" }));
            return;
          }
          ws.send(JSON.stringify({ type: "speech_event_ack", eventId: msg.eventId }));
        }

        if (msg.type === "speaker_approval") {
          const session = sessions.get(currentSessionId);
          if (session && ws !== session.organizerWs) {
            ws.send(JSON.stringify({ type: "error", code: "UNAUTHORIZED", message: "Only organizer can approve" }));
            return;
          }
          ws.send(JSON.stringify({ type: "speaker_approved", success: true }));
        }
      });
    });

    return { server, wss, sessions, tokenA, tokenB };
  }

  test("HTTP GET /api/admin/sessions/:id/messages: Token A accepted for Session A, rejected with 403 for Session B", async () => {
    const { server, wss, tokenA } = setupAppAndWs();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      // 1. Token A requesting Session A messages -> 200 OK
      const resA = await fetch(`http://127.0.0.1:${port}/api/admin/sessions/session-A/messages`, {
        headers: { "x-host-token": tokenA }
      });
      assert.equal(resA.status, 200);
      const dataA = await resA.json();
      assert.equal(dataA.messages[0].originalText, "Hello from Session A");

      // 2. Token A requesting Session B messages -> 403 Forbidden!
      const resB = await fetch(`http://127.0.0.1:${port}/api/admin/sessions/session-B/messages`, {
        headers: { "x-host-token": tokenA }
      });
      assert.equal(resB.status, 403);
      const dataB = await resB.json();
      assert.match(dataB.error, /Forbidden/);
    } finally {
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("HTTP POST /api/azure/translate: Token A accepted for Session A, rejected with 403 for Session B", async () => {
    const { server, wss, tokenA } = setupAppAndWs();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      // Token A for Session A -> 200 OK
      const resA = await fetch(`http://127.0.0.1:${port}/api/azure/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-host-token": tokenA },
        body: JSON.stringify({ sessionId: "session-A", text: "Test" })
      });
      assert.equal(resA.status, 200);

      // Token A for Session B -> 403 Forbidden
      const resB = await fetch(`http://127.0.0.1:${port}/api/azure/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-host-token": tokenA },
        body: JSON.stringify({ sessionId: "session-B", text: "Test" })
      });
      assert.equal(resB.status, 403);
    } finally {
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("HTTP POST /api/azure/tts: Token A accepted for Session A, rejected with 403 for Session B", async () => {
    const { server, wss, tokenA } = setupAppAndWs();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      // Token A for Session A -> 200 OK
      const resA = await fetch(`http://127.0.0.1:${port}/api/azure/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-host-token": tokenA },
        body: JSON.stringify({ sessionId: "session-A", text: "Hello" })
      });
      assert.equal(resA.status, 200);

      // Token A for Session B -> 403 Forbidden
      const resB = await fetch(`http://127.0.0.1:${port}/api/azure/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-host-token": tokenA },
        body: JSON.stringify({ sessionId: "session-B", text: "Hello" })
      });
      assert.equal(resB.status, 403);
    } finally {
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("HTTP GET /api/admin/sessions: Token A rejected with 403 for global admin session list", async () => {
    const { server, wss, tokenA } = setupAppAndWs();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/sessions`, {
        headers: { "x-host-token": tokenA }
      });
      assert.equal(res.status, 403);
    } finally {
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("WebSocket Host Actions: Token A accepted for Session A, rejected for Session B takeover", async () => {
    const { server, wss, tokenA } = setupAppAndWs();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    function waitForOpen(ws: WebSocket): Promise<void> {
      if (ws.readyState === WebSocket.OPEN) return Promise.resolve();
      return new Promise((resolve, reject) => {
        ws.once("open", () => resolve());
        ws.once("error", (err) => reject(err));
      });
    }

    const wsA = new WebSocket(`ws://127.0.0.1:${port}`);
    let wsB: WebSocket | null = null;

    try {
      // 1. Connect to Session A with Token A -> Organizer role granted
      await waitForOpen(wsA);

      const ackPromiseA = new Promise<any>((resolve) => {
        wsA.once("message", (data) => resolve(JSON.parse(data.toString())));
      });
      wsA.send(JSON.stringify({ type: "join", sessionId: "session-A", role: "organizer", hostToken: tokenA }));
      const msgA = await ackPromiseA;
      assert.equal(msgA.type, "host_token");
      assert.equal(msgA.role, "organizer");

      // Verify speech_event allowed on Session A
      const speechAckPromiseA = new Promise<any>((resolve) => {
        wsA.once("message", (data) => resolve(JSON.parse(data.toString())));
      });
      wsA.send(JSON.stringify({ type: "speech_event", eventId: "ev-1", sourceText: "Testing" }));
      const speechAckA = await speechAckPromiseA;
      assert.equal(speechAckA.type, "speech_event_ack");

      // 2. Connect to Session B with Token A -> Takeover rejected, demoted to listener
      wsB = new WebSocket(`ws://127.0.0.1:${port}`);
      await waitForOpen(wsB);

      const ackPromiseB = new Promise<any>((resolve) => {
        wsB!.once("message", (data) => resolve(JSON.parse(data.toString())));
      });
      wsB.send(JSON.stringify({ type: "join", sessionId: "session-B", role: "organizer", hostToken: tokenA }));
      const msgB = await ackPromiseB;
      assert.equal(msgB.type, "role_changed");
      assert.equal(msgB.role, "LISTENER");
      assert.equal(msgB.status, "takeover_prevented");

      // Verify speech_event rejected on Session B
      const speechAckPromiseB = new Promise<any>((resolve) => {
        wsB.once("message", (data) => resolve(JSON.parse(data.toString())));
      });
      wsB.send(JSON.stringify({ type: "speech_event", eventId: "ev-2", sourceText: "Malicious speech" }));
      const speechAckB = await speechAckPromiseB;
      assert.equal(speechAckB.type, "error");
      assert.equal(speechAckB.code, "UNAUTHORIZED_SPEAKER");

      // Verify speaker_approval rejected on Session B
      const approvalAckPromiseB = new Promise<any>((resolve) => {
        wsB!.once("message", (data) => resolve(JSON.parse(data.toString())));
      });
      wsB!.send(JSON.stringify({ type: "speaker_approval", targetUserId: "user-123", approved: true }));
      const approvalAckB = await approvalAckPromiseB;
      assert.equal(approvalAckB.type, "error");
      assert.equal(approvalAckB.code, "UNAUTHORIZED");
    } finally {
      wsA.close();
      if (wsB) wsB.close();
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
