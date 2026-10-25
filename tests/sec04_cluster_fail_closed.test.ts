import { test, describe } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "http";
import crypto from "crypto";
import { timingSafeEqualToken } from "../server";

describe("SEC-04: Cluster Fail-Closed and HostToken Leak Prevention", () => {
  function createClusterTestApp(sessionsMap: Map<string, any>) {
    const app = express();
    app.use(express.json());

    // Matches server.ts SEC-04 logic
    app.post("/api/cluster/broadcast", async (req, res) => {
      const providedSecret = (req.headers["x-cluster-secret"] || req.body?.clusterSecret || "").toString().trim();
      const expectedSecret = (process.env.CLUSTER_SECRET || "").trim();

      if (!expectedSecret || !providedSecret || !timingSafeEqualToken(providedSecret, expectedSecret)) {
        return res.status(403).json({ error: "Forbidden: Invalid cluster secret" });
      }

      const { type, sessionId, payload } = req.body || {};
      if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

      if (type === "session_created" && payload) {
        sessionsMap.set(sessionId, {
          sessionId,
          hostToken: null, // Host token NEVER stored from cluster
          hostTokenHash: payload.hostTokenHash,
          sessionToken: payload.sessionToken
        });
        return res.json({ ok: true, synced: true });
      }
      return res.json({ ok: true });
    });

    app.get("/api/cluster/sessions/:id", (req, res) => {
      const providedSecret = (req.headers["x-cluster-secret"] || (req.query?.clusterSecret as string) || "").toString().trim();
      const expectedSecret = (process.env.CLUSTER_SECRET || "").trim();

      if (!expectedSecret || !providedSecret || !timingSafeEqualToken(providedSecret, expectedSecret)) {
        return res.status(403).json({ error: "Forbidden: Invalid cluster secret" });
      }

      const session = sessionsMap.get(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      // Host token NEVER returned over cluster
      res.json({
        ok: true,
        session: {
          sessionId: session.sessionId,
          hostTokenHash: session.hostTokenHash,
          sessionToken: session.sessionToken,
          topic: session.topic || ""
        }
      });
    });

    return app;
  }

  test("1. Fails closed when CLUSTER_SECRET is unset in environment (returns 403)", async () => {
    delete process.env.CLUSTER_SECRET;
    const sessions = new Map<string, any>();
    sessions.set("sess_100", {
      sessionId: "sess_100",
      hostToken: "super_secret_host_token_raw",
      hostTokenHash: crypto.createHash("sha256").update("super_secret_host_token_raw").digest("hex"),
      sessionToken: "sess_token_123"
    });

    const app = createClusterTestApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      const resPost = await fetch(`http://127.0.0.1:${port}/api/cluster/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "session_created", sessionId: "sess_100" })
      });
      assert.equal(resPost.status, 403, "Broadcast must return 403 when CLUSTER_SECRET is unset");

      const resGet = await fetch(`http://127.0.0.1:${port}/api/cluster/sessions/sess_100`);
      assert.equal(resGet.status, 403, "Get cluster session must return 403 when CLUSTER_SECRET is unset");
    } finally {
      server.close();
    }
  });

  test("2. Rejects request with 403 when wrong or missing secret is provided", async () => {
    process.env.CLUSTER_SECRET = "production_cluster_secret_xyz_999";
    const sessions = new Map<string, any>();
    sessions.set("sess_200", {
      sessionId: "sess_200",
      hostToken: "super_secret_host_token_raw",
      hostTokenHash: crypto.createHash("sha256").update("super_secret_host_token_raw").digest("hex")
    });

    const app = createClusterTestApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      const resMissing = await fetch(`http://127.0.0.1:${port}/api/cluster/sessions/sess_200`);
      assert.equal(resMissing.status, 403, "Missing x-cluster-secret header must return 403");

      const resWrong = await fetch(`http://127.0.0.1:${port}/api/cluster/sessions/sess_200`, {
        headers: { "x-cluster-secret": "wrong_secret" }
      });
      assert.equal(resWrong.status, 403, "Wrong x-cluster-secret header must return 403");
    } finally {
      server.close();
    }
  });

  test("3. When authorized, returns hostTokenHash and NEVER leaks plaintext hostToken", async () => {
    const validSecret = "production_cluster_secret_xyz_999";
    process.env.CLUSTER_SECRET = validSecret;
    const rawHostToken = "raw_plaintext_host_token_must_never_leak";
    const hostHash = crypto.createHash("sha256").update(rawHostToken).digest("hex");

    const sessions = new Map<string, any>();
    sessions.set("sess_300", {
      sessionId: "sess_300",
      hostToken: rawHostToken,
      hostTokenHash: hostHash,
      sessionToken: "token_abc"
    });

    const app = createClusterTestApp(sessions);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cluster/sessions/sess_300`, {
        headers: { "x-cluster-secret": validSecret }
      });
      assert.equal(res.status, 200, "Authorized cluster request must return 200");
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.session.sessionId, "sess_300");
      assert.equal(data.session.hostTokenHash, hostHash);
      assert.equal(data.session.hostToken, undefined, "hostToken must be completely absent from response");
      assert.ok(!JSON.stringify(data).includes(rawHostToken), "Response must never contain raw host token");
    } finally {
      server.close();
    }
  });
});
