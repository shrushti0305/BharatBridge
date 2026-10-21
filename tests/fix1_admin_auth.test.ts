import { test, describe } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "http";
import { timingSafeEqualToken } from "../server";

describe("FIX 1: Admin Auth Hardening", () => {
  // Helper to create an isolated test express server matching server.ts admin guard
  function createTestServer() {
    const app = express();
    app.use(express.json());

    function verifyAdminAccess(req: any): boolean {
      const envAdminToken = (process.env.ADMIN_TOKEN || "").trim();
      if (!envAdminToken) {
        return false;
      }

      const adminTokenHeader = (req.headers["x-admin-token"] || "").toString().trim();
      const authHeader = (req.headers["authorization"] || "").toString().trim();
      let clientToken = adminTokenHeader;
      if (!clientToken && authHeader.startsWith("Bearer ")) {
        clientToken = authHeader.substring(7).trim();
      }

      if (!clientToken) {
        return false;
      }

      return timingSafeEqualToken(clientToken, envAdminToken);
    }

    app.get("/api/admin/sessions", (req, res) => {
      if (!verifyAdminAccess(req)) {
        return res.status(403).json({ error: "Forbidden: Admin authorization required" });
      }
      return res.status(200).json({ sessions: [] });
    });

    return app;
  }

  test("denies access when ADMIN_TOKEN is unset (NODE_ENV unset)", async () => {
    delete process.env.NODE_ENV;
    delete process.env.ADMIN_TOKEN;

    const app = createTestServer();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/sessions`, {
        headers: { "x-admin-token": "any-token" }
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, "Forbidden: Admin authorization required");
    } finally {
      server.close();
    }
  });

  test("denies access when no token is provided (ADMIN_TOKEN set, NODE_ENV unset)", async () => {
    delete process.env.NODE_ENV;
    process.env.ADMIN_TOKEN = "secure_test_admin_token_99";

    const app = createTestServer();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/sessions`);
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, "Forbidden: Admin authorization required");
    } finally {
      server.close();
    }
  });

  test("denies access when wrong token is provided (ADMIN_TOKEN set, NODE_ENV unset)", async () => {
    delete process.env.NODE_ENV;
    process.env.ADMIN_TOKEN = "secure_test_admin_token_99";

    const app = createTestServer();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/sessions`, {
        headers: { "x-admin-token": "wrong_token_guess" }
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, "Forbidden: Admin authorization required");
    } finally {
      server.close();
    }
  });

  test("allows access (200 OK) when correct token is provided via x-admin-token (NODE_ENV unset)", async () => {
    delete process.env.NODE_ENV;
    process.env.ADMIN_TOKEN = "secure_test_admin_token_99";

    const app = createTestServer();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/sessions`, {
        headers: { "x-admin-token": "secure_test_admin_token_99" }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, { sessions: [] });
    } finally {
      server.close();
    }
  });

  test("allows access (200 OK) when correct token is provided via Authorization Bearer (NODE_ENV unset)", async () => {
    delete process.env.NODE_ENV;
    process.env.ADMIN_TOKEN = "secure_test_admin_token_99";

    const app = createTestServer();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/sessions`, {
        headers: { "Authorization": "Bearer secure_test_admin_token_99" }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, { sessions: [] });
    } finally {
      server.close();
    }
  });

  test("constant-time timingSafeEqualToken handles mismatched lengths securely", () => {
    assert.equal(timingSafeEqualToken("abc", "abcdef"), false);
    assert.equal(timingSafeEqualToken("abcdef", "abc"), false);
    assert.equal(timingSafeEqualToken("", "abc"), false);
    assert.equal(timingSafeEqualToken("abc", "abc"), true);
  });
});
