import { io } from "socket.io-client";
import { api } from "./api.js";

// Creates a fresh authenticated socket connection. Caller is responsible for disconnecting it
// (e.g. on component unmount) — we don't share a singleton because speaker/listener sessions
// have very different lifecycles.
export function connectSocket(token) {
  return io(api.serverUrl || window.location.origin, {
    auth: { token },
    transports: ["websocket", "polling"],
  });
}
