import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { authRouter } from "./auth.js";
import { sessionsRouter } from "./sessions.js";
import { speechRouter } from "./speech.js";
import { registerRealtime } from "./realtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../client/dist");

const isProduction = process.env.NODE_ENV === "production";

// Crash safety: log unexpected errors instead of letting the process die silently with no
// trace. In production this is the difference between "found out from a user mid-event" and
// "found out from the logs immediately."
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled promise rejection:", reason);
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "\n[warning] ANTHROPIC_API_KEY is not set. The end-of-session summary will fail until it is.\n"
  );
}
if (!process.env.AZURE_TRANSLATOR_KEY || !process.env.AZURE_TRANSLATOR_REGION) {
  console.warn(
    "\n[warning] AZURE_TRANSLATOR_KEY / AZURE_TRANSLATOR_REGION are not set. Live translation will fail until they are (captions will fall back to the original language).\n"
  );
}
if (!process.env.DB_ENCRYPTION_KEY) {
  console.warn(
    "\n[warning] DB_ENCRYPTION_KEY is not set — the database file will NOT be password-protected.\n"
  );
}
if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
  console.warn(
    "\n[warning] AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are not set. Speech-to-text and text-to-speech will fail until they are.\n"
  );
}
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret-change-me" || process.env.JWT_SECRET === "change-this-to-a-long-random-string")) {
  console.error(
    "\n[FATAL] JWT_SECRET is missing or still set to the placeholder value while NODE_ENV=production. Refusing to start — anyone could forge login tokens. Set a real random JWT_SECRET in your environment.\n"
  );
  process.exit(1);
}

const app = express();
const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/speech", speechRouter);

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    setHeaders: (res, filepath) => {
      if (filepath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Generic fallback error handler: ensures any unexpected error in a route returns a clean
// JSON response instead of leaking a stack trace or an HTML error page to the client.
app.use((err, req, res, next) => {
  console.error("[ERROR]", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: isProduction ? origins : true, credentials: true },
});
registerRealtime(io);

const PORT = process.env.PORT || 8787;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Live Translate server listening on http://0.0.0.0:${PORT}`);
});