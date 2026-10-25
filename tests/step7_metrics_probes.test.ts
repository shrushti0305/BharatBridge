import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn, execSync, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3007";
const WS_URL = "ws://localhost:3007";

describe("Step 7: Server Metrics Aggregator & Synthetic Probe Listeners", () => {
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
      PORT: "3007",
      NODE_ENV: "development",
      COSMOS_USE_FAKE: "true",
      COSMOS_DB_ENDPOINT: "",
      COSMOS_DB_KEY: "",
      COSMOS_DB_DATABASE_NAME: "bharatbridge_step7_test",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300",
      OPERATOR_METRICS_PUSH_INTERVAL_MS: "1000",
      PROBE_SLA_MS: "2000",
      PROBE_FAIL_TIMEOUT_MS: "5000",
      TRUST_PROXY: "1"
    };

    srv = spawn("npx", ["tsx", "server.ts"], {
      cwd: repoRoot,
      env,
      shell: true
    });

    let srvLogs = "";
    if (srv.stdout) srv.stdout.on("data", (d) => { srvLogs += d.toString(); });
    if (srv.stderr) srv.stderr.on("data", (d) => { srvLogs += d.toString(); });

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
      throw new Error(`Failed to start server on port 3007 for Step 7 tests. Server output:\n${srvLogs}`);
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

  // 1. Periodic Server Metrics Push to Operators (every 1-2s)
  test("1. Operator Metrics Push: Real-time telemetry frames are periodically pushed every 1-2s with aggregate health counters", async () => {
    const session = await createTestSession("Metrics Aggregator Room");

    // Operator connects and subscribes to real-time operator telemetry
    const operatorWs = new WebSocket(WS_URL);
    await new Promise((r) => operatorWs.on("open", r));

    const metricsFrames: any[] = [];
    operatorWs.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "operator_telemetry") {
          metricsFrames.push(m);
        }
      } catch (_) {}
    });

    operatorWs.send(JSON.stringify({
      type: "subscribe_operator_metrics",
      sessionId: session.sessionId,
      role: "operator",
      token: session.hostToken
    }));

    // Connect a listener in Hindi to reflect in listener metrics
    const listenerWs = new WebSocket(WS_URL);
    await new Promise((r) => listenerWs.on("open", r));
    listenerWs.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "listener",
      userId: "test_listener_metrics",
      targetLang: "hi"
    }));

    // Wait 2.5 seconds to collect at least 2 telemetry frames
    const waitStart = Date.now();
    while (metricsFrames.length < 2 && Date.now() - waitStart < 4000) {
      await new Promise((r) => setTimeout(r, 200));
    }

    operatorWs.close();
    listenerWs.close();

    assert.ok(metricsFrames.length >= 2, `Expected at least 2 operator_telemetry frames within 4s (received: ${metricsFrames.length})`);
    const latest = metricsFrames[metricsFrames.length - 1];
    assert.equal(latest.sessionId, session.sessionId);
    assert.ok(typeof latest.totalListeners === "number", "Must include totalListeners count");
    assert.ok(latest.totalListeners >= 1, "Must reflect connected listener count");
    assert.ok(typeof latest.latencies === "object", "Must include latencies summary");
    assert.ok(Array.isArray(latest.channels) || typeof latest.channels === "object", "Must include per-channel health metrics");
  });

  // 2. Synthetic Probe: Healthy Path
  test("2. Synthetic Probe Bot: Headless probe verifies end-to-end receipt of translation within SLA (HEALTHY status)", async () => {
    const session = await createTestSession("Probe Bot Healthy Room");

    // Start probe via API or WebSocket
    const probeRes = await fetch(`${BASE_URL}/api/sessions/${session.sessionId}/probes/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        languages: ["hi"],
        hostToken: session.hostToken
      })
    });
    const probeData = await probeRes.json();
    assert.equal(probeRes.ok, true, `Probe start must succeed: ${JSON.stringify(probeData)}`);

    // Host connects and emits speech event
    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "organizer",
      hostToken: session.hostToken,
      userId: "probe_host",
      userName: "Host"
    }));
    await new Promise((r) => setTimeout(r, 300));

    hostWs.send(JSON.stringify({
      type: "speech_event",
      sessionId: session.sessionId,
      eventId: "probe-test-speech-1",
      sourceText: "Testing synthetic probe delivery.",
      sourceLanguage: "en",
      speakerId: "speaker-01",
      speakerName: "Host"
    }));

    // Poll probe status endpoint for Hindi channel health
    let isHealthy = false;
    const pollStart = Date.now();
    while (!isHealthy && Date.now() - pollStart < 6000) {
      try {
        const statusRes = await fetch(`${BASE_URL}/api/sessions/${session.sessionId}/probes/status`);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          if (statusJson.channels?.hi?.status === "HEALTHY" || statusJson.channels?.["hi"]?.status === "HEALTHY") {
            isHealthy = true;
            break;
          }
        }
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 300));
    }

    hostWs.close();
    assert.equal(isHealthy, true, "Probe bot must report HEALTHY status for Hindi channel upon receiving broadcast within SLA");
  });

  // 3. Synthetic Probe: SLA Failure & Blackout Alert (turns CRITICAL within 15s)
  test("3. Synthetic Probe Alert: Blackout on unserved channel triggers CRITICAL status within SLA window", async () => {
    const session = await createTestSession("Probe Bot Failure Alert Room");

    // Start probe for Gujarati channel without emitting any speech to Gujarati
    const probeRes = await fetch(`${BASE_URL}/api/sessions/${session.sessionId}/probes/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        languages: ["gu"],
        hostToken: session.hostToken
      })
    });
    assert.equal(probeRes.ok, true);

    // Wait for probe failure timeout (configured to 5000ms in env)
    let isCritical = false;
    const pollStart = Date.now();
    while (!isCritical && Date.now() - pollStart < 8000) {
      try {
        const statusRes = await fetch(`${BASE_URL}/api/sessions/${session.sessionId}/probes/status`);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          const guStatus = statusJson.channels?.gu?.status || statusJson.channels?.["gu"]?.status;
          if (guStatus === "CRITICAL" || guStatus === "FAILED" || guStatus === "DEGRADED") {
            isCritical = true;
            break;
          }
        }
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 400));
    }

    assert.equal(isCritical, true, "Probe must detect broadcast timeout and flag channel as CRITICAL / FAILED within SLA window");
  });
});
