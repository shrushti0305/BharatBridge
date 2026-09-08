import express from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./auth.js";
import { mintSpeechToken } from "./azureSpeechToken.js";

export const speechRouter = express.Router();

// Tokens are valid ~10 minutes and the frontend refreshes proactively before expiry, so this
// only needs to be called a handful of times per hour per user in normal use — this limit
// exists purely to blunt abuse, not to constrain legitimate use.
const speechTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many token requests. Please wait a bit and try again." },
});

speechRouter.get("/token", requireAuth, speechTokenLimiter, async (req, res) => {
  try {
    const { token, region } = await mintSpeechToken();
    res.json({ token, region });
  } catch (err) {
    console.error("mintSpeechToken failed:", err.message);
    res.status(502).json({ error: `Could not reach Azure Speech service: ${err.message}` });
  }
});