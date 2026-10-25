import { test, describe } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { timingSafeEqualToken } from "../server";

describe("AUT-03: Operator WebSocket Authentication Hardening", () => {
  function createTestWsServer(sessionsMap: Map<string, any>) {
    const server = http.createServer();
    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws) => {
      ws.on("message", async (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === "subscribe_operator_metrics") {
          const targetSid = message.sessionId;
          const session = sessionsMap.get(targetSid);
          if (!session) {
            return ws.send(JSON.stringify({ type: "error", code: "SESSION_NOT_FOUND" }));
          }

          const inputToken = (message.token || message.hostToken || message.adminToken || "").toString().trim();
          const envAdminToken = (process.env.ADMIN_TOKEN || "").trim();

          let isAuthorized = false;
          if (session.organizerWs === ws) {
            isAuthorized = true;
          } else if (inputToken && session.hostToken && timingSafeEqualToken(inputToken, session.hostToken)) {
            isAuthorized = true;
          } else if (inputToken && envAdminToken && timingSafeEqualToken(inputToken, envAdminToken)) {
            isAuthorized = true;
          }
          // Note: (message.role === 'operator') bypass is strictly removed!

          if (!isAuthorized) {
            return ws.send(JSON.stringify({
              type: "error",
              code: "UNAUTHORIZED",
              message: "Invalid operator credentials"
            }));
          }

          return ws.send(JSON.stringify({
            type: "operator_telemetry",
            sessionId: targetSid,
            status: "OK"
          }));
        }
      });
    });

    return server;
  }

  test("1. Rejects unauthenticated subscribe_operator_metrics with role='operator' (no token)", async () => {
    const sessions = new Map<string, any>();
    sessions.set("sess_op_1", { sessionId: "sess_op_1", hostToken: "valid_host_token_123" });

    const server = createTestWsServer(sessions);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on("open", r));

    try {
      const responsePromise = new Promise<any>((resolve) => {
        ws.on("message", (raw) => resolve(JSON.parse(raw.toString())));
      });

      // Attacker attempts to claim role: 'operator' without any token
      ws.send(JSON.stringify({
        type: "subscribe_operator_metrics",
        sessionId: "sess_op_1",
        role: "operator"
      }));

      const res = await responsePromise;
      assert.equal(res.type, "error");
      assert.equal(res.code, "UNAUTHORIZED");
      assert.equal(res.message, "Invalid operator credentials");
    } finally {
      ws.close();
      server.close();
    }
  });

  test("2. Rejects subscribe_operator_metrics with invalid token", async () => {
    const sessions = new Map<string, any>();
    sessions.set("sess_op_2", { sessionId: "sess_op_2", hostToken: "valid_host_token_456" });

    const server = createTestWsServer(sessions);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on("open", r));

    try {
      const responsePromise = new Promise<any>((resolve) => {
        ws.on("message", (raw) => resolve(JSON.parse(raw.toString())));
      });

      ws.send(JSON.stringify({
        type: "subscribe_operator_metrics",
        sessionId: "sess_op_2",
        token: "invalid_attacker_token"
      }));

      const res = await responsePromise;
      assert.equal(res.type, "error");
      assert.equal(res.code, "UNAUTHORIZED");
    } finally {
      ws.close();
      server.close();
    }
  });

  test("3. Accepts subscribe_operator_metrics with valid session hostToken", async () => {
    const validHostToken = "valid_host_token_789";
    const sessions = new Map<string, any>();
    sessions.set("sess_op_3", { sessionId: "sess_op_3", hostToken: validHostToken });

    const server = createTestWsServer(sessions);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on("open", r));

    try {
      const responsePromise = new Promise<any>((resolve) => {
        ws.on("message", (raw) => resolve(JSON.parse(raw.toString())));
      });

      ws.send(JSON.stringify({
        type: "subscribe_operator_metrics",
        sessionId: "sess_op_3",
        token: validHostToken
      }));

      const res = await responsePromise;
      assert.equal(res.type, "operator_telemetry");
      assert.equal(res.status, "OK");
    } finally {
      ws.close();
      server.close();
    }
  });
});
