import WebSocket from "ws";

const BASE_URL = "http://localhost:3000";
const WS_URL = "ws://localhost:3000";

function waitForMsg(ws, predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMsg);
      reject(new Error(`Timeout waiting for message (${timeout}ms)`));
    }, timeout);
    function onMsg(raw) {
      try {
        const msg = JSON.parse(raw.toString());
        if (predicate(msg)) {
          clearTimeout(timer);
          ws.off("message", onMsg);
          resolve(msg);
        }
      } catch (e) {}
    }
    ws.on("message", onMsg);
  });
}

async function run() {
  console.log("=== STARTING LIVE ROLE TESTS ===");

  // 1. Create a session for listener organizer-frame test
  const c1 = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "Listener Organizer Frame Test" })
  }).then(r => r.json());
  const s1Id = c1.sessionId;

  // Connect as listener
  const wsListener = new WebSocket(WS_URL);
  await new Promise(r => wsListener.on("open", r));
  wsListener.send(JSON.stringify({
    type: "join",
    sessionId: s1Id,
    role: "listener",
    userId: "listener_user_99",
    userName: "Listener 99"
  }));
  await waitForMsg(wsListener, m => m.type === "room_state" || m.type === "stats");

  // Listener attempts to send organizer-only frame: speaker_approval
  console.log("\n--- TEST 4.1: Listener sending speaker_approval frame ---");
  const approvalErrPromise = waitForMsg(wsListener, m => m.type === "error");
  wsListener.send(JSON.stringify({
    type: "speaker_approval",
    sessionId: s1Id,
    targetUserId: "some_victim",
    approved: true
  }));
  const approvalErr = await approvalErrPromise;
  console.log("Server response to listener sending speaker_approval:", approvalErr);

  // 2. Joins claiming speaker / panelist
  console.log("\n--- TEST 4.2: Joins claiming speaker or panelist without token ---");
  const wsSpeakerClaim = new WebSocket(WS_URL);
  await new Promise(r => wsSpeakerClaim.on("open", r));
  const speakerDemotePromise = waitForMsg(wsSpeakerClaim, m => m.type === "role_changed" || m.type === "error");
  wsSpeakerClaim.send(JSON.stringify({
    type: "join",
    sessionId: s1Id,
    role: "speaker",
    userId: "fake_speaker",
    userName: "Fake Speaker"
  }));
  const speakerDemoteMsg = await speakerDemotePromise;
  console.log("Server response to unauthenticated 'speaker' join:", speakerDemoteMsg);

  const wsPanelistClaim = new WebSocket(WS_URL);
  await new Promise(r => wsPanelistClaim.on("open", r));
  const panelistJoinPromise = waitForMsg(wsPanelistClaim, m => m.type === "room_state" || m.type === "stats");
  wsPanelistClaim.send(JSON.stringify({
    type: "join",
    sessionId: s1Id,
    role: "panelist",
    userId: "fake_panelist",
    userName: "Fake Panelist"
  }));
  const panelistJoinMsg = await panelistJoinPromise;
  console.log("Server response to unauthenticated 'panelist' join (treated as listener):", panelistJoinMsg.type);

  // 3. Duo mode auto-approve for third joiner
  console.log("\n--- TEST 4.3: Duo mode auto-approve for a THIRD joiner ---");
  const cDuo = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "Duo Third Joiner Test", isDuoMode: true })
  }).then(r => r.json());
  const duoId = cDuo.sessionId;

  // Host joins
  const wsDuoHost = new WebSocket(WS_URL);
  await new Promise(r => wsDuoHost.on("open", r));
  wsDuoHost.send(JSON.stringify({
    type: "join",
    sessionId: duoId,
    role: "organizer",
    hostToken: cDuo.hostToken,
    userId: "duo_host_1",
    isDuoMode: true
  }));
  await waitForMsg(wsDuoHost, m => m.type === "host_token" || m.type === "room_state");

  // Partner 2 joins and requests speaker
  const wsDuoP2 = new WebSocket(WS_URL);
  await new Promise(r => wsDuoP2.on("open", r));
  wsDuoP2.send(JSON.stringify({
    type: "join",
    sessionId: duoId,
    role: "listener",
    userId: "duo_partner_2",
    userName: "Partner 2"
  }));
  await waitForMsg(wsDuoP2, m => m.type === "room_state" || m.type === "stats");

  const p2ApprovePromise = waitForMsg(wsDuoP2, m => m.type === "role_changed");
  wsDuoP2.send(JSON.stringify({
    type: "speaker_request",
    sessionId: duoId,
    userId: "duo_partner_2",
    userName: "Partner 2"
  }));
  const p2ApproveMsg = await p2ApprovePromise;
  console.log("Partner 2 auto-approve result:", p2ApproveMsg);

  // Partner 3 (THIRD joiner in duo mode) sends speaker_request
  const wsDuoP3 = new WebSocket(WS_URL);
  await new Promise(r => wsDuoP3.on("open", r));
  wsDuoP3.send(JSON.stringify({
    type: "join",
    sessionId: duoId,
    role: "listener",
    userId: "duo_partner_3",
    userName: "Partner 3 (Third Person)"
  }));
  await waitForMsg(wsDuoP3, m => m.type === "room_state" || m.type === "stats");

  const p3ApprovePromise = waitForMsg(wsDuoP3, m => m.type === "role_changed");
  wsDuoP3.send(JSON.stringify({
    type: "speaker_request",
    sessionId: duoId,
    userId: "duo_partner_3",
    userName: "Partner 3 (Third Person)"
  }));
  const p3ApproveMsg = await p3ApprovePromise;
  console.log("Partner 3 (Third Person) in duo mode result:", p3ApproveMsg);

  // 4. Speaker request in a non-duo session
  console.log("\n--- TEST 4.4: Speaker request in a NON-DUO session ---");
  const cNonDuo = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "Non-Duo Test", isDuoMode: false })
  }).then(r => r.json());
  const nonDuoId = cNonDuo.sessionId;

  const wsNonDuoUser = new WebSocket(WS_URL);
  await new Promise(r => wsNonDuoUser.on("open", r));
  wsNonDuoUser.send(JSON.stringify({
    type: "join",
    sessionId: nonDuoId,
    role: "listener",
    userId: "nonduo_listener",
    userName: "Non-Duo Listener"
  }));
  await waitForMsg(wsNonDuoUser, m => m.type === "room_state" || m.type === "stats");

  const nonDuoReqPromise = waitForMsg(wsNonDuoUser, m => m.type === "speaker_request_status" || m.type === "role_changed");
  wsNonDuoUser.send(JSON.stringify({
    type: "speaker_request",
    sessionId: nonDuoId,
    userId: "nonduo_listener",
    userName: "Non-Duo Listener"
  }));
  const nonDuoReqMsg = await nonDuoReqPromise;
  console.log("Non-duo speaker request result (must NOT auto-approve):", nonDuoReqMsg);

  // Cleanup
  wsListener.close();
  wsSpeakerClaim.close();
  wsPanelistClaim.close();
  wsDuoHost.close();
  wsDuoP2.close();
  wsDuoP3.close();
  wsNonDuoUser.close();
  console.log("\n=== ALL ROLE TESTS COMPLETED ===");
}

run().catch(console.error);
