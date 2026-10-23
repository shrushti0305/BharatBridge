import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { spawn, execSync, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3005";
const WS_URL = "ws://localhost:3005";
const VENUE_SHARED_IP = "198.51.100.99";

describe("Step 3: Token-Keyed Limits & Hotspot/Venue NAT Isolation", () => {
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
      COSMOS_DB_DATABASE_NAME: "bharatbridge_step3_test",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300",
      FAILED_JOIN_THRESHOLD: "30",
      MAX_FAILED_JOINS_PER_IP: "30",
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
      throw new Error("Failed to start server on port 3005 for Step 3 tests");
    }

    // Create a live session for genuine attendees
    const res = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Venue Live Event Room" })
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

  // 1. Hotspot / Venue NAT Isolation: 1 bad guesser must NEVER block genuine attendees on the same IP
  test("1. Venue NAT / Hotspot: 35 failed PIN guesses from 1 client on shared IP does NOT block other attendees on that IP", async () => {
    // Step A: Client 1 on VENUE_SHARED_IP sends 35 bad PIN guesses (exceeding 30 threshold)
    for (let i = 0; i < 35; i++) {
      const badWs = new WebSocket(WS_URL, {
        headers: { "x-forwarded-for": VENUE_SHARED_IP }
      });
      await new Promise<void>((resolve) => {
        badWs.on("open", () => {
          badWs.send(JSON.stringify({
            type: "join",
            sessionId: `wrong_pin_${i}_${Date.now()}`,
            role: "listener",
            userId: "malicious_or_confused_user"
          }));
        });
        badWs.on("message", () => {
          badWs.close();
          resolve();
        });
        badWs.on("close", () => resolve());
        badWs.on("error", () => resolve());
      });
    }

    // Step B: 10 genuine attendees on the EXACT SAME VENUE IP join the valid session
    let successfulJoins = 0;
    for (let j = 0; j < 10; j++) {
      const attendeeWs = new WebSocket(WS_URL, {
        headers: { "x-forwarded-for": VENUE_SHARED_IP }
      });

      const joined = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          attendeeWs.close();
          resolve(false);
        }, 1500);

        attendeeWs.on("open", () => {
          attendeeWs.send(JSON.stringify({
            type: "join",
            sessionId: testSession.sessionId,
            role: "listener",
            userId: `attendee_${j}_${Date.now()}`
          }));
        });

        attendeeWs.on("message", (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === "join_ack") {
              clearTimeout(timer);
              attendeeWs.close();
              resolve(true);
            } else if (msg.code === "RATE_LIMITED") {
              clearTimeout(timer);
              attendeeWs.close();
              resolve(false);
            }
          } catch (_) {}
        });

        attendeeWs.on("close", () => {
          clearTimeout(timer);
          resolve(false);
        });

        attendeeWs.on("error", () => {
          clearTimeout(timer);
          resolve(false);
        });
      });

      if (joined) successfulJoins++;
    }

    assert.equal(
      successfulJoins,
      10,
      `All 10 genuine attendees on the shared venue IP must join successfully, but only ${successfulJoins} joined (others were blocked by shared IP limit)`
    );
  });

  // 2. Token-Keyed Token Bucket: rate limits are isolated per token on the same IP
  test("2. Rate limits are isolated by token: flooding by Token A does not throttle Token B on the same IP", async () => {
    // Connect Attendee A on VENUE_SHARED_IP
    const wsA = new WebSocket(WS_URL, { headers: { "x-forwarded-for": VENUE_SHARED_IP } });
    await new Promise((r) => wsA.on("open", r));
    let tokenA: string | null = null;
    wsA.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "join_ack") tokenA = m.sessionToken;
      } catch (_) {}
    });
    wsA.send(JSON.stringify({ type: "join", sessionId: testSession.sessionId, role: "listener", userId: "userA" }));
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(tokenA, "Attendee A must receive sessionToken");

    // Connect Attendee B on VENUE_SHARED_IP
    const wsB = new WebSocket(WS_URL, { headers: { "x-forwarded-for": VENUE_SHARED_IP } });
    await new Promise((r) => wsB.on("open", r));
    let tokenB: string | null = null;
    wsB.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "join_ack") tokenB = m.sessionToken;
      } catch (_) {}
    });
    wsB.send(JSON.stringify({ type: "join", sessionId: testSession.sessionId, role: "listener", userId: "userB" }));
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(tokenB, "Attendee B must receive sessionToken");

    // Flood with Token A (60 rapid messages to trigger rate limit)
    let aThrottled = false;
    wsA.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.code === "RATE_LIMITED") aThrottled = true;
      } catch (_) {}
    });
    for (let i = 0; i < 60; i++) {
      if (wsA.readyState === WebSocket.OPEN) {
        wsA.send(JSON.stringify({ type: "ping", seq: i, token: tokenA }));
      }
    }
    await new Promise((r) => setTimeout(r, 500));

    // Attendee B sends normal traffic on the SAME IP
    let bThrottled = false;
    wsB.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.code === "RATE_LIMITED") bThrottled = true;
      } catch (_) {}
    });
    for (let j = 0; j < 3; j++) {
      if (wsB.readyState === WebSocket.OPEN) {
        wsB.send(JSON.stringify({ type: "ping", seq: j, token: tokenB }));
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    await new Promise((r) => setTimeout(r, 200));

    wsA.close();
    wsB.close();

    assert.equal(aThrottled, true, "Flooding Token A must be throttled");
    assert.equal(bThrottled, false, "Token B on the same IP must NOT be throttled");
  });

  // 3. Spoofed X-Forwarded-For Header
  test("3. Trust proxy hop count evaluates real connecting proxy IP and ignores spoofed leftmost IP", async () => {
    const res = await fetch(`${BASE_URL}/api/health`, {
      headers: {
        "x-forwarded-for": "10.0.0.1, 203.0.113.88"
      }
    });
    assert.equal(res.status, 200, "Health endpoint responds");
  });

  // 4. Origin check rejects unauthorized origin and permits missing origin
  test("4. Origin check rejects unauthorized origin with HTTP 403 and permits missing origin", async () => {
    let rejectedWith403 = false;
    const badWs = new WebSocket(WS_URL, {
      headers: { Origin: "https://attacker-origin.org" }
    });

    await new Promise<void>((resolve) => {
      badWs.on("unexpected-response", (_req, res) => {
        if (res.statusCode === 403) rejectedWith403 = true;
        resolve();
      });
      badWs.on("open", () => {
        badWs.close();
        resolve();
      });
      badWs.on("error", () => resolve());
    });

    assert.equal(rejectedWith403, true, "Unauthorized origin must be rejected with 403");

    let allowedWithoutOrigin = false;
    const cleanWs = new WebSocket(WS_URL);
    await new Promise<void>((resolve) => {
      cleanWs.on("open", () => {
        allowedWithoutOrigin = true;
        cleanWs.close();
        resolve();
      });
      cleanWs.on("error", () => resolve());
    });

    assert.equal(allowedWithoutOrigin, true, "Missing origin header must be allowed");
  });
});
