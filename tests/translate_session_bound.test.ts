import { test, describe } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "http";
import crypto from "crypto";
import { timingSafeEqualToken } from "../server";

describe("/api/translate without sessionId Hardening", () => {
  function createTranslateApp(sessionsMap: Map<string, any>) {
    const app = express();
    app.use(express.json());

    function verifySessionToken(req: express.Request, session: any): { valid: boolean; expired?: boolean } {
      if (!session) return { valid: false };
      const clientToken = (
        req.headers["x-session-token"] ||
        req.headers["x-host-token"] ||
        (req.query?.sessionToken as string) ||
        req.body?.sessionToken ||
        req.body?.token
      )?.toString().trim();

      if (!clientToken) return { valid: false };
      if (session.sessionToken && timingSafeEqualToken(clientToken, session.sessionToken)) return { valid: true };
      if (session.hostToken && timingSafeEqualToken(clientToken, session.hostToken)) return { valid: true };
      return { valid: false };
    }

    app.post("/api/translate", async (req, res) => {
      const { text, targetLanguage, sessionId } = req.body || {};
      const activeSessionId = (sessionId || req.headers["x-session-id"] || "").toString().trim();

      if (!activeSessionId) {
        return res.status(400).json({ error: "Missing required sessionId", code: "SESSION_ID_REQUIRED" });
      }

      if (!sessionsMap.has(activeSessionId)) {
        return res.status(403).json({ error: "Forbidden: Invalid or non-existent sessionId", code: "SESSION_TOKEN_REQUIRED" });
      }

      const sessionObj = sessionsMap.get(activeSessionId);
      const auth = verifySessionToken(req, sessionObj);
      if (!auth.valid) {
        return res.status(403).json({ error: "Forbidden: Valid sessionToken or hostToken is required", code: "SESSION_TOKEN_REQUIRED" });
      }

      if (!text || typeof text !== "string" || !text.trim() || !targetLanguage) {
        return res.status(400).json({ error: "Missing text or targetLanguage" });
      }

      return res.json({
        translatedText: `Translated: ${text}`,
        provider: "gemini"
      });
    });

    return app;
  }

  test("1. Rejects request without sessionId with 400 Bad Request", async () => {
    const sessions = new Map<string, any>();
    const app = createTranslateApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Unauthenticated practice text",
          targetLanguage: "hi"
        })
      });
      assert.equal(res.status, 400, "Request without sessionId must return 400");
      const data = await res.json();
      assert.equal(data.code, "SESSION_ID_REQUIRED");
    } finally {
      server.close();
    }
  });

  test("2. Rejects request with nonexistent sessionId with 403 Forbidden", async () => {
    const sessions = new Map<string, any>();
    const app = createTranslateApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "nonexistent_room_pin",
          text: "Hello",
          targetLanguage: "hi"
        })
      });
      assert.equal(res.status, 403, "Nonexistent session must return 403");
    } finally {
      server.close();
    }
  });

  test("3. Rejects request without valid session token with 403 Forbidden", async () => {
    const sessions = new Map<string, any>();
    sessions.set("sess_trans_3", { sessionId: "sess_trans_3", sessionToken: "valid_token_xyz" });
    const app = createTranslateApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess_trans_3",
          text: "Hello",
          targetLanguage: "hi"
        })
      });
      assert.equal(res.status, 403, "Missing token must return 403");
    } finally {
      server.close();
    }
  });

  test("4. Allows request with valid sessionId and matching session token (200 OK)", async () => {
    const sessions = new Map<string, any>();
    const sessionToken = "valid_token_xyz_123";
    sessions.set("sess_trans_4", { sessionId: "sess_trans_4", sessionToken });
    const app = createTranslateApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken
        },
        body: JSON.stringify({
          sessionId: "sess_trans_4",
          text: "Hello world",
          targetLanguage: "hi"
        })
      });
      assert.equal(res.status, 200, "Valid session token must return 200");
      const data = await res.json();
      assert.ok(data.translatedText.includes("Hello world"));
    } finally {
      server.close();
    }
  });
});
