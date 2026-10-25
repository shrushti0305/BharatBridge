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

describe("Step 5: Panel Mode (Up to 10 Speakers, STT Gated by Mic State)", () => {
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
      COSMOS_DB_DATABASE_NAME: "bharatbridge_step5_test",
      AZURE_STORAGE_CONNECTION_STRING: "",
      TRANSLATION_TIMEOUT_MS: "300",
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
      throw new Error("Failed to start server on port 3005 for Step 5 tests");
    }

    // Create session via API
    const res = await fetch(`${BASE_URL}/api/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "10-Speaker Panel Mode Test" })
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

  // 1. Support up to 10 active panelists; 11th request receives limit_reached
  test("1. Panelist Capacity: Room accommodates up to 10 panelists (1 host + 9 guests); 11th joiner receives limit_reached", async () => {
    // Connect Host
    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    let latestRoomState: any = null;
    hostWs.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "room_state") latestRoomState = m;
      } catch (_) {}
    });

    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "host_speaker",
      userName: "Host Speaker"
    }));
    await new Promise((r) => setTimeout(r, 400));

    // Connect and approve 9 guest panelists (total 10 with host)
    const panelistSockets: WebSocket[] = [];
    for (let i = 2; i <= 10; i++) {
      const pWs = new WebSocket(WS_URL);
      await new Promise((r) => pWs.on("open", r));
      panelistSockets.push(pWs);
      const uid = `panelist_user_${i}`;

      pWs.send(JSON.stringify({
        type: "join",
        sessionId: testSession.sessionId,
        role: "listener",
        userId: uid,
        userName: `Panelist ${i}`
      }));
      await new Promise((r) => setTimeout(r, 100));

      // Panelist requests to speak
      pWs.send(JSON.stringify({
        type: "speaker_request",
        sessionId: testSession.sessionId,
        userId: uid,
        userName: `Panelist ${i}`
      }));
      await new Promise((r) => setTimeout(r, 150));

      // Host approves request
      hostWs.send(JSON.stringify({
        type: "speaker_approval",
        sessionId: testSession.sessionId,
        targetUserId: uid,
        approved: true
      }));
      await new Promise((r) => setTimeout(r, 150));
    }

    assert.ok(latestRoomState, "Host must have received room_state");
    assert.equal(latestRoomState.activePanelistCount, 10, "Room must have exactly 10 active panelists");
    assert.equal(latestRoomState.panelists?.length, 10, "Panelists list must contain 10 entries");

    // 11th attendee tries to request speaker status
    const attendee11Ws = new WebSocket(WS_URL);
    await new Promise((r) => attendee11Ws.on("open", r));
    let attendee11Result: any = null;
    attendee11Ws.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "role_changed" && m.status === "limit_reached") {
          attendee11Result = m;
        }
      } catch (_) {}
    });

    attendee11Ws.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "listener",
      userId: "attendee_11",
      userName: "Attendee 11"
    }));
    await new Promise((r) => setTimeout(r, 100));

    attendee11Ws.send(JSON.stringify({
      type: "speaker_request",
      sessionId: testSession.sessionId,
      userId: "attendee_11",
      userName: "Attendee 11"
    }));
    await new Promise((r) => setTimeout(r, 400));

    assert.ok(attendee11Result, "11th speaker request must receive limit_reached response");
    assert.equal(attendee11Result.role, "LISTENER", "11th joiner must remain a LISTENER");

    // Cleanup sockets for next test
    attendee11Ws.close();
    for (const ws of panelistSockets) ws.close();
    hostWs.close();
  });

  // 2. Mute/Unmute State Tracking & Server Audio/Speech Gating
  test("2. Mic Gate: Muted panelist audio is dropped and speech_event is rejected with MIC_MUTED; unmuting re-enables speech", async () => {
    // Connect Host
    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "host_speaker",
      userName: "Host Speaker"
    }));
    await new Promise((r) => setTimeout(r, 300));

    // Connect Panelist 2
    const panelistWs = new WebSocket(WS_URL);
    await new Promise((r) => panelistWs.on("open", r));
    const panelistMessages: any[] = [];
    panelistWs.on("message", (raw) => {
      try {
        panelistMessages.push(JSON.parse(raw.toString()));
      } catch (_) {}
    });

    panelistWs.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "listener",
      userId: "panelist_test_mic",
      userName: "Mic Test Panelist"
    }));
    await new Promise((r) => setTimeout(r, 100));

    panelistWs.send(JSON.stringify({
      type: "speaker_request",
      sessionId: testSession.sessionId,
      userId: "panelist_test_mic",
      userName: "Mic Test Panelist"
    }));
    await new Promise((r) => setTimeout(r, 100));

    hostWs.send(JSON.stringify({
      type: "speaker_approval",
      sessionId: testSession.sessionId,
      targetUserId: "panelist_test_mic",
      approved: true
    }));
    await new Promise((r) => setTimeout(r, 200));

    // Panelist self-mutes
    panelistWs.send(JSON.stringify({
      type: "mic_state",
      sessionId: testSession.sessionId,
      isMuted: true
    }));
    await new Promise((r) => setTimeout(r, 200));

    // Verify room_state reflects isMuted: true
    const roomStateAfterMute = panelistMessages.filter((m) => m.type === "room_state").pop();
    const panelistInRoster = roomStateAfterMute?.panelists?.find((p: any) => p.userId === "panelist_test_mic");
    assert.ok(panelistInRoster, "Panelist must be in room_state roster");
    assert.equal(panelistInRoster.isMuted, true, "Panelist must be marked as isMuted: true in room_state");

    // Attempt to send speech_event while muted -> Must be rejected with MIC_MUTED
    panelistWs.send(JSON.stringify({
      type: "speech_event",
      sessionId: testSession.sessionId,
      eventId: "test-muted-speech",
      sourceText: "This should be blocked because microphone is muted.",
      sourceLanguage: "en",
      speakerId: panelistInRoster.speakerId,
      speakerName: "Mic Test Panelist"
    }));
    await new Promise((r) => setTimeout(r, 300));

    const micMutedErr = panelistMessages.find((m) => m.code === "MIC_MUTED");
    assert.ok(micMutedErr, "Speech event sent while muted must be rejected with code MIC_MUTED");

    // Panelist un-mutes
    panelistWs.send(JSON.stringify({
      type: "mic_state",
      sessionId: testSession.sessionId,
      isMuted: false
    }));
    await new Promise((r) => setTimeout(r, 200));

    // Send speech_event while unmuted -> Must be accepted with speech_event_ack
    panelistWs.send(JSON.stringify({
      type: "speech_event",
      sessionId: testSession.sessionId,
      eventId: "test-unmuted-speech",
      sourceText: "This should be accepted because microphone is now unmuted.",
      sourceLanguage: "en",
      speakerId: panelistInRoster.speakerId,
      speakerName: "Mic Test Panelist"
    }));
    await new Promise((r) => setTimeout(r, 300));

    const ackMsg = panelistMessages.find((m) => m.type === "speech_event_ack" && m.eventId === "test-unmuted-speech");
    assert.ok(ackMsg, "Speech event sent while unmuted must be acknowledged with speech_event_ack");

    panelistWs.close();
    hostWs.close();
  });

  // 3. Host Remote Mute Control
  test("3. Host Remote Mute: Host can remotely mute a panelist; panelist receives mic_control frame", async () => {
    // Connect Host
    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "host_speaker",
      userName: "Host Speaker"
    }));
    await new Promise((r) => setTimeout(r, 300));

    // Connect Panelist
    const panelistWs = new WebSocket(WS_URL);
    await new Promise((r) => panelistWs.on("open", r));
    const panelistMessages: any[] = [];
    panelistWs.on("message", (raw) => {
      try {
        panelistMessages.push(JSON.parse(raw.toString()));
      } catch (_) {}
    });

    panelistWs.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "listener",
      userId: "target_mute_user",
      userName: "Target Mute User"
    }));
    await new Promise((r) => setTimeout(r, 100));

    panelistWs.send(JSON.stringify({
      type: "speaker_request",
      sessionId: testSession.sessionId,
      userId: "target_mute_user",
      userName: "Target Mute User"
    }));
    await new Promise((r) => setTimeout(r, 100));

    hostWs.send(JSON.stringify({
      type: "speaker_approval",
      sessionId: testSession.sessionId,
      targetUserId: "target_mute_user",
      approved: true
    }));
    await new Promise((r) => setTimeout(r, 200));

    // Host remotely mutes panelist
    hostWs.send(JSON.stringify({
      type: "mute_panelist",
      sessionId: testSession.sessionId,
      targetUserId: "target_mute_user",
      isMuted: true,
      token: testSession.hostToken
    }));
    await new Promise((r) => setTimeout(r, 300));

    const micControl = panelistMessages.find((m) => m.type === "mic_control" && m.action === "mute");
    assert.ok(micControl, "Panelist must receive mic_control action: mute frame from server");

    // Non-host attempts to remotely mute host -> Rejected with UNAUTHORIZED
    let imposterError: any = null;
    panelistWs.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.code === "UNAUTHORIZED") imposterError = m;
      } catch (_) {}
    });
    panelistWs.send(JSON.stringify({
      type: "mute_panelist",
      sessionId: testSession.sessionId,
      targetUserId: "host_speaker",
      isMuted: true
    }));
    await new Promise((r) => setTimeout(r, 300));

    assert.ok(imposterError, "Unauthorized client attempting mute_panelist must be rejected with UNAUTHORIZED");

    panelistWs.close();
    hostWs.close();
  });

  // 4. Concurrent Active Speaker Indicator Broadcast
  test("4. Active Speaker Indicator: Speaking panelist triggers active_speaker broadcast received by all room attendees", async () => {
    // Connect Host
    const hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on("open", r));
    hostWs.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "organizer",
      hostToken: testSession.hostToken,
      userId: "host_speaker",
      userName: "Host Speaker"
    }));
    await new Promise((r) => setTimeout(r, 200));

    // Connect Listener
    const listenerWs = new WebSocket(WS_URL);
    await new Promise((r) => listenerWs.on("open", r));
    let activeSpeakerHeardByListener: any = null;
    listenerWs.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "active_speaker") activeSpeakerHeardByListener = m;
      } catch (_) {}
    });

    listenerWs.send(JSON.stringify({
      type: "join",
      sessionId: testSession.sessionId,
      role: "listener",
      userId: "listener_observer",
      userName: "Listener Observer"
    }));
    await new Promise((r) => setTimeout(r, 200));

    // Host sends speech event
    hostWs.send(JSON.stringify({
      type: "speech_event",
      sessionId: testSession.sessionId,
      eventId: "active-speaker-event-1",
      sourceText: "Host is now speaking actively to the panel.",
      sourceLanguage: "en",
      speakerId: "speaker-01",
      speakerName: "Host Speaker"
    }));
    await new Promise((r) => setTimeout(r, 400));

    assert.ok(activeSpeakerHeardByListener, "Listener must receive active_speaker indicator frame");
    assert.equal(activeSpeakerHeardByListener.speakerId, "speaker-01", "Active speaker must identify speaker-01");
    assert.equal(activeSpeakerHeardByListener.userName, "Host Speaker", "Active speaker must identify Host Speaker");

    listenerWs.close();
    hostWs.close();
  });
});
