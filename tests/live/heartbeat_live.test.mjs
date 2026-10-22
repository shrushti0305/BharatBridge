import WebSocket from "ws";

const BASE_URL = "http://localhost:3005";
const WS_URL = "ws://localhost:3005";

async function main() {
  console.log("=== BATCH 4 FIX-UP ITEM 4: LIVE SERVER HEARTBEAT TERMINATION TEST ===");

  // Create session
  const res = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "audit_heartbeat_test" })
  });
  const { sessionId } = await res.json();
  console.log(`Created session: ${sessionId}`);

  const ws = new WebSocket(WS_URL);
  
  // Disable automatic pong reply
  // Node ws library allows disabling autoPong or overriding pong
  ws._autoPong = false;
  ws.pong = () => {
    console.log("[CLIENT] Suppressed sending pong to server ping!");
  };

  const startTime = Date.now();
  let pingCount = 0;

  ws.on("open", () => {
    console.log(`[CLIENT] Connected at t=0s. Sending join frame...`);
    ws.send(JSON.stringify({
      type: "join",
      sessionId,
      role: "listener",
      targetLang: "hi"
    }));
  });

  ws.on("ping", (data) => {
    pingCount++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[CLIENT] Received server PING #${pingCount} at t=${elapsed}s (NOT answering with pong)`);
  });

  const closePromise = new Promise((resolve) => {
    ws.on("close", (code, reason) => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[CLIENT] Socket CLOSED by server at t=${elapsed}s! Code: ${code}, Reason: "${reason.toString()}"`);
      resolve({ code, elapsed, pingCount });
    });
    ws.on("error", (err) => {
      console.log(`[CLIENT] Socket ERROR: ${err.message}`);
    });
  });

  console.log("Waiting for server heartbeat 30s interval to detect missing pong and terminate socket...");
  const result = await closePromise;

  console.log("\n=== HEARTBEAT TEST SUMMARY ===");
  console.log(`Termination Elapsed Time: ${result.elapsed} seconds`);
  console.log(`Close Code: ${result.code}`);
  console.log(`Pings Received and Ignored: ${result.pingCount}`);
  if (result.elapsed >= 30 && result.elapsed <= 65) {
    console.log("Result: PASS - Server cleanly terminated unanswering client within the expected 30-60s heartbeat window.");
  } else {
    console.log(`Result: UNEXPECTED TIMING (${result.elapsed}s)`);
  }
}

main().catch(console.error);
