import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { db } from "./db.js";
import crypto from "crypto";
import { sendPasswordResetEmail } from "./mailer.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "30d";

export function signToken(user) {
  return jwt.sign({ sub: user.id, name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

// Express middleware: requires a valid Bearer token, attaches req.user.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, name: payload.name, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Same verification, used by Socket.IO handshake (doesn't have Express req/res).
export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { id: payload.sub, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}

export const authRouter = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post("/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
    return res.status(400).json({ error: "Name is required and must be under 100 characters." });
  }
  if (!email || typeof email !== "string" || email.length > 255 || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (!password || typeof password !== "string" || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: "Password must be between 6 and 128 characters." });
  }
  const cleanEmail = email.toLowerCase().trim();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const id = nanoid();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)").run(
    id,
    name.trim(),
    cleanEmail,
    password_hash
  );
  const user = { id, name: name.trim(), email: cleanEmail };
  res.json({ token: signToken(user), user });
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ error: "email and password are required" });
  }

  const cleanEmail = email.toLowerCase().trim();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(cleanEmail);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const user = { id: row.id, name: row.name, email: row.email };
  res.json({ token: signToken(user), user });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  const cleanEmail = email.toLowerCase().trim();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(cleanEmail);

  if (!row) {
    return res.json({ message: "If an account exists for that email, a password reset email has been sent." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  const id = nanoid();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
  db.prepare(
    "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, row.id, token, expiresAt);

  const clientOrigin = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",")[0].trim();
  const resetLink = `${clientOrigin}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail({ to: row.email, name: row.name, resetLink });
  } catch (err) {
    console.error("[Mailer Error] Failed to send password reset email:", err.message);
  }

  const isProduction = process.env.NODE_ENV === "production";
  const responseData = {
    message: "If an account exists for that email, a password reset email has been sent.",
  };

  if (!isProduction) {
    responseData.resetLink = resetLink;
  }

  res.json(responseData);
});

authRouter.post("/reset-password", (req, res) => {
  const { token, password } = req.body || {};
  if (!token || typeof token !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ error: "token and password are required" });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: "Password must be between 6 and 128 characters." });
  }
  const row = db.prepare("SELECT * FROM password_reset_tokens WHERE token = ?").get(token);
  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(password_hash, row.user_id);
  db.prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ?").run(row.id);
  res.json({ message: "Password updated. You can now log in." });
});