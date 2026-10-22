import WebSocket from "ws";

const BASE_URL = "http://localhost:3005";
const WS_URL = "ws://localhost:3005";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function waitForMsg(ws, type, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMsg);
      reject(new Error(`Timeout waiting for message type='${type}'`));
    }, timeout);

    function onMsg(raw) {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === type) {
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
  console.log("=== BATCH 4 PATCH ITEM 2: RECONNECT RACE - SPEECH EVENT TEST ===");

  // 1. Create session
  const res = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "audit_reconnect_race_speech" })
  });
  const data = await res.json();
  const sessionId = data.sessionId;
  const hostToken = data.hostToken;
  console.log(`Created session: ${sessionId}`);

  // 2. Open Socket A (Organizer #1)
  console.log("Opening Socket A (Organizer #1)...");
  const wsA = new WebSocket(WS_URL);
  await new Promise(r => wsA.on("open", r));
  const pRoomA = waitForMsg(wsA, "room_state");
  wsA.send(JSON.stringify({
    type: "join",
    sessionId,
    role: "organizer",
    hostToken,
    userId: "host_tab_a",
    userName: "Host Tab A",
    targetLang: "hi"
  }));
  await pRoomA;

  // 3. Open Socket B (Organizer #2 / Reconnect) BEFORE Socket A closes
  console.log("Opening Socket B (Organizer #2 / Reconnect)...");
  const wsB = new WebSocket(WS_URL);
  await new Promise(r => wsB.on("open", r));
  const pRoomB = waitForMsg(wsB, "room_state");
  wsB.send(JSON.stringify({
    type: "join",
    sessionId,
    role: "organizer",
    hostToken,
    userId: "host_tab_b",
    userName: "Host Tab B",
    targetLang: "hi"
  }));
  await pRoomB;

  // 4. Close Socket A
  console.log("Closing Socket A now...");
  wsA.close();
  await sleep(1500);

  // 5. Send speech_event from Socket B
  console.log("Sending speech_event from Socket B after Socket A is closed...");
  const receivedOnB = [];
  wsB.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      receivedOnB.push(msg);
      console.log(`[SOCKET B RECV] Type: '${msg.type}'`, JSON.stringify(msg));
    } catch (_) {}
  });

  wsB.send(JSON.stringify({
    type: "speech_event",
    eventId: "reconnect-race-speech-1",
    sourceText: "Can everyone hear me on the reconnected socket?",
    sourceLanguage: "en-IN",
    targetLang: "hi",
    isFinal: true,
    speakerId: "speaker-01",
    sequenceNumber: 1
  }));

  await sleep(3000);

  console.log("\n=== ALL RESPONSES RECEIVED ON SOCKET B ===");
  console.log(JSON.stringify(receivedOnB, null, 2));

  wsB.close();
}

run().catch(console.error);
