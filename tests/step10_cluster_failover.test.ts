import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn, execSync, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const INSTANCE1_PORT = "3010";
const INSTANCE2_PORT = "3011";
const BASE_URL_1 = `http://localhost:${INSTANCE1_PORT}`;
const BASE_URL_2 = `http://localhost:${INSTANCE2_PORT}`;
const WS_URL_1 = `ws://localhost:${INSTANCE1_PORT}`;
const WS_URL_2 = `ws://localhost:${INSTANCE2_PORT}`;

describe("Step 10: Multi-Instance Cluster, Cross-Node Fan-Out & Failover", () => {
  let srv1: ChildProcess | null = null;
  let srv2: ChildProcess | null = null;

  async function waitForHealth(baseUrl: string, maxWaitMs = 25000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const res = await fetch(`${baseUrl}/api/health`);
        if (res.ok) return true;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }

  before(async () => {
    const clusterSecret = "test-cluster-shared-secret-123";

    // Common env configuration
    const baseEnv = {
      ...process.env,
      NODE_ENV: "development",
      COSMOS_USE_FAKE: "true",
      COSMOS_DB_ENDPOINT: "",
      COSMOS_DB_KEY: "",
      COSMOS_DB_DATABASE_NAME: "bharatbridge_step10_cluster",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300",
      CLUSTER_SECRET: clusterSecret,
      TRUST_PROXY: "1"
    };

    // Instance 1
    srv1 = spawn("npx", ["tsx", "server.ts"], {
      cwd: repoRoot,
      env: {
        ...baseEnv,
        PORT: INSTANCE1_PORT,
        CLUSTER_PEER_URLS: BASE_URL_2
      },
      shell: true
    });

    // Instance 2
    srv2 = spawn("npx", ["tsx", "server.ts"], {
      cwd: repoRoot,
      env: {
        ...baseEnv,
        PORT: INSTANCE2_PORT,
        CLUSTER_PEER_URLS: BASE_URL_1
      },
      shell: true
    });

    const [ok1, ok2] = await Promise.all([
      waitForHealth(BASE_URL_1),
      waitForHealth(BASE_URL_2)
    ]);

    if (!ok1 || !ok2) {
      cleanupProcesses();
      throw new Error(`Failed to spin up dual-instance cluster. Instance 1 ok: ${ok1}, Instance 2 ok: ${ok2}`);
    }
  });

  function cleanupProcesses() {
    for (const proc of [srv1, srv2]) {
      if (proc && proc.pid) {
        if (process.platform === "win32") {
          try { execSync(`taskkill /pid ${proc.pid} /t /f`, { stdio: "ignore" }); } catch (_) {}
        } else {
          try { proc.kill("SIGKILL"); } catch (_) {}
        }
      }
    }
  }

  after(() => {
    cleanupProcesses();
  });

  // 1. Cross-Instance Message Fan-Out
  test("1. Cross-Instance Fan-Out: Speaker on Instance 1 broadcasts to Listener on Instance 2", async () => {
    // Create session on Instance 1
    const createRes = await fetch(`${BASE_URL_1}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cluster Broadcast Room" })
    });
    const session = await createRes.json() as { sessionId: string; hostToken: string; sessionToken: string };
    assert.ok(session.sessionId, "Session must be created on Instance 1");

    // Also hydrate session onto Instance 2 via cluster peer sync or create
    // Listener connects to Instance 2
    const listenerWs = new WebSocket(WS_URL_2);
    await new Promise((r) => listenerWs.on("open", r));

    const receivedTranscriptions: any[] = [];
    listenerWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "transcription" && msg.eventId === "cross-instance-speech-1") {
          receivedTranscriptions.push(msg);
        }
      } catch (_) {}
    });

    listenerWs.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "listener",
      targetLang: "hi",
      userId: "cluster_listener_node2"
    }));
    await new Promise((r) => setTimeout(r, 400));

    // Host connects to Instance 1
    const hostWs = new WebSocket(WS_URL_1);
    await new Promise((r) => hostWs.on("open", r));

    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "organizer",
      hostToken: session.hostToken,
      userId: "cluster_host_node1"
    }));
    await new Promise((r) => setTimeout(r, 400));

    // Host on Instance 1 emits speech event
    hostWs.send(JSON.stringify({
      type: "speech_event",
      sessionId: session.sessionId,
      eventId: "cross-instance-speech-1",
      sequenceNumber: 1,
      sourceText: "Broadcast across cluster instances.",
      sourceLanguage: "en",
      speakerId: "speaker-01",
      speakerName: "Host"
    }));

    // Listener on Instance 2 should receive the broadcast via the cluster backplane
    const waitStart = Date.now();
    while (receivedTranscriptions.length === 0 && Date.now() - waitStart < 5000) {
      await new Promise((r) => setTimeout(r, 200));
    }

    hostWs.close();
    listenerWs.close();

    assert.equal(
      receivedTranscriptions.length,
      1,
      "Listener on Instance 2 must receive transcription broadcast initiated on Instance 1"
    );
    assert.equal(receivedTranscriptions[0].targetLang, "hi");
  });

  // 2. Instance Failover & Session Survival
  test("2. Instance Failover: Killing Instance 1 mid-broadcast does not end session; Host reclaims on Instance 2", async () => {
    // Create new session on Instance 1
    const createRes = await fetch(`${BASE_URL_1}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Failover Resilience Room" })
    });
    const session = await createRes.json() as { sessionId: string; hostToken: string; sessionToken: string };

    // Listener connects to Instance 2
    const listenerWs = new WebSocket(WS_URL_2);
    await new Promise((r) => listenerWs.on("open", r));

    const failoverTranscriptions: any[] = [];
    listenerWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "transcription" && msg.eventId === "post-failover-speech-1") {
          failoverTranscriptions.push(msg);
        }
      } catch (_) {}
    });

    listenerWs.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "listener",
      targetLang: "hi",
      userId: "failover_listener"
    }));
    await new Promise((r) => setTimeout(r, 400));

    // Host connects to Instance 1
    const hostWs1 = new WebSocket(WS_URL_1);
    await new Promise((r) => hostWs1.on("open", r));
    hostWs1.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "organizer",
      hostToken: session.hostToken,
      userId: "host_node1"
    }));
    await new Promise((r) => setTimeout(r, 400));

    // KILL Instance 1 abruptly!
    if (srv1 && srv1.pid) {
      if (process.platform === "win32") {
        try { execSync(`taskkill /pid ${srv1.pid} /t /f`, { stdio: "ignore" }); } catch (_) {}
      } else {
        srv1.kill("SIGKILL");
      }
      srv1 = null;
    }
    hostWs1.close();

    // Confirm Instance 1 is down
    let instance1Dead = false;
    try {
      await fetch(`${BASE_URL_1}/api/health`);
    } catch (_) {
      instance1Dead = true;
    }
    assert.equal(instance1Dead, true, "Instance 1 must be confirmed dead");

    // Host reconnects to Instance 2 with hostToken
    const hostWs2 = new WebSocket(WS_URL_2);
    await new Promise((r) => hostWs2.on("open", r));

    let hostReclaimed = false;
    hostWs2.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "join_ack" && m.role === "organizer") {
          hostReclaimed = true;
        }
      } catch (_) {}
    });

    hostWs2.send(JSON.stringify({
      type: "join",
      sessionId: session.sessionId,
      role: "organizer",
      hostToken: session.hostToken,
      userId: "host_reconnected_node2"
    }));

    const reclaimStart = Date.now();
    while (!hostReclaimed && Date.now() - reclaimStart < 4000) {
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.equal(hostReclaimed, true, "Host must successfully reclaim organizer role on Instance 2");

    // Host emits speech on Instance 2
    hostWs2.send(JSON.stringify({
      type: "speech_event",
      sessionId: session.sessionId,
      eventId: "post-failover-speech-1",
      sequenceNumber: 1,
      sourceText: "We have survived instance 1 failure.",
      sourceLanguage: "en",
      speakerId: "speaker-01",
      speakerName: "Host"
    }));

    // Listener on Instance 2 should receive the post-failover broadcast
    const waitFailover = Date.now();
    while (failoverTranscriptions.length === 0 && Date.now() - waitFailover < 5000) {
      await new Promise((r) => setTimeout(r, 200));
    }

    hostWs2.close();
    listenerWs.close();

    assert.equal(
      failoverTranscriptions.length,
      1,
      "Listener must receive post-failover speech broadcast after Instance 1 termination"
    );
  });
});
