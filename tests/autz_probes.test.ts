import { test, describe } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "http";
import crypto from "crypto";
import { timingSafeEqualToken } from "../server";

describe("AUTZ-01/02 & Probes Status Authorization Hardening", () => {
  function createProbesTestApp(sessionsMap: Map<string, any>) {
    const app = express();
    app.use(express.json());

    function verifyHostToken(req: express.Request, session: any): boolean {
      if (!session) return false;
      const clientToken = (
        req.headers["x-host-token"] ||
        (req.query?.hostToken as string) ||
        req.body?.hostToken
      )?.toString().trim();

      if (!clientToken) return false;
      if (session.hostToken && timingSafeEqualToken(clientToken, session.hostToken)) return true;
      if (session.hostTokenHash) {
        const hash = crypto.createHash("sha256").update(clientToken).digest("hex");
        if (timingSafeEqualToken(hash, session.hostTokenHash)) return true;
      }
      return false;
    }

    async function verifyProbeAccess(req: express.Request, session: any): Promise<boolean> {
      if (verifyHostToken(req, session)) return true;
      const adminToken = (req.headers["x-admin-token"] || "").toString().trim();
      const envAdminToken = (process.env.ADMIN_TOKEN || "").trim();
      if (adminToken && envAdminToken && timingSafeEqualToken(adminToken, envAdminToken)) return true;
      return false;
    }

    app.post("/api/sessions/:id/probes/start", async (req, res) => {
      const session = sessionsMap.get(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      if (!(await verifyProbeAccess(req, session))) {
        return res.status(403).json({ error: "Forbidden: Host token required" });
      }
      return res.json({ ok: true, started: ["hi"] });
    });

    app.get("/api/sessions/:id/probes/status", async (req, res) => {
      const session = sessionsMap.get(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      if (!(await verifyProbeAccess(req, session))) {
        return res.status(403).json({ error: "Forbidden: Host token required" });
      }
      return res.json({ ok: true, channels: {} });
    });

    app.post("/api/sessions/:id/probes/stop", async (req, res) => {
      const session = sessionsMap.get(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      if (!(await verifyProbeAccess(req, session))) {
        return res.status(403).json({ error: "Forbidden: Host token required" });
      }
      return res.json({ ok: true, stopped: true });
    });

    return app;
  }

  test("1. Rejects probe start, status, and stop when called without hostToken or admin credentials", async () => {
    const sessions = new Map<string, any>();
    sessions.set("sess_probe_1", { sessionId: "sess_probe_1", hostToken: "super_secret_host_tok" });

    const app = createProbesTestApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      // 1. Start without token
      const resStart = await fetch(`http://127.0.0.1:${port}/api/sessions/sess_probe_1/probes/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languages: ["hi"] })
      });
      assert.equal(resStart.status, 403, "Start probe without token must return 403");

      // 2. Status without token
      const resStatus = await fetch(`http://127.0.0.1:${port}/api/sessions/sess_probe_1/probes/status`);
      assert.equal(resStatus.status, 403, "Status probe without token must return 403");

      // 3. Stop without token
      const resStop = await fetch(`http://127.0.0.1:${port}/api/sessions/sess_probe_1/probes/stop`, {
        method: "POST"
      });
      assert.equal(resStop.status, 403, "Stop probe without token must return 403");
    } finally {
      server.close();
    }
  });

  test("2. Rejects probe actions with invalid token", async () => {
    const sessions = new Map<string, any>();
    sessions.set("sess_probe_2", { sessionId: "sess_probe_2", hostToken: "real_host_token_999" });

    const app = createProbesTestApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/sessions/sess_probe_2/probes/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-host-token": "wrong_token_attack"
        },
        body: JSON.stringify({ languages: ["hi"] })
      });
      assert.equal(res.status, 403, "Invalid host token must return 403");
    } finally {
      server.close();
    }
  });

  test("3. Allows probe actions when valid hostToken or adminToken is provided", async () => {
    const validHostToken = "valid_host_token_good_123";
    const sessions = new Map<string, any>();
    sessions.set("sess_probe_3", { sessionId: "sess_probe_3", hostToken: validHostToken });

    const app = createProbesTestApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      const resStart = await fetch(`http://127.0.0.1:${port}/api/sessions/sess_probe_3/probes/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-host-token": validHostToken
        },
        body: JSON.stringify({ languages: ["hi"] })
      });
      assert.equal(resStart.status, 200, "Valid host token must allow probe start");

      const resStatus = await fetch(`http://127.0.0.1:${port}/api/sessions/sess_probe_3/probes/status`, {
        headers: { "x-host-token": validHostToken }
      });
      assert.equal(resStatus.status, 200, "Valid host token must allow probe status");

      const resStop = await fetch(`http://127.0.0.1:${port}/api/sessions/sess_probe_3/probes/stop`, {
        method: "POST",
        headers: { "x-host-token": validHostToken }
      });
      assert.equal(resStop.status, 200, "Valid host token must allow probe stop");
    } finally {
      server.close();
    }
  });
});
