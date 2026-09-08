# Relay — live event interpretation

Relay lets one speaker broadcast a live session while every listener reads and hears the same speech in their own selected Indian regional language. It supports English, Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati, Malayalam, Punjabi, and Odia.

## What is included

- Account registration and authenticated speaker/listener roles
- Per-session six-character join codes
- Continuous browser speech recognition for the speaker, live captions, and per-language Socket.IO delivery
- Server-side AI translation, persisted transcripts/translations, and automatic end-of-session notes
- Device-native translated text-to-speech for listeners (never the speaker's original voice)
- Late join and language-change caption catch-up, plus session history restricted to attendees

## Run locally

1. Use Node.js 20 or 22 LTS (the SQLite dependency currently has no prebuilt binary for Node 24), then copy `server/.env.example` to `server/.env`, set `ANTHROPIC_API_KEY` and a strong `JWT_SECRET`.
2. In one terminal run `cd server` then `npm.cmd run dev`.
3. In another run `cd client` then `npm.cmd run dev`.
4. Open `http://localhost:5173` in Chrome or Edge. Give the speaker microphone permission.

The default persistence location is `server/data/live-translate.db`. For a cloud deployment, point `DB_PATH` to a mounted persistent volume. Set `CLIENT_ORIGIN` to the production frontend URL and `VITE_SERVER_URL` at client build time to the public backend URL.

## Deployment notes

Run the server behind TLS (microphone access requires a secure origin outside localhost). Keep Socket.IO on sticky WebSocket-capable infrastructure. A single backend instance serves many concurrent listeners; for horizontal scaling, use a shared database and Socket.IO's Redis adapter so language rooms work across instances. The included SQLite setup is appropriate for a single durable service/volume; use managed Postgres for multi-instance production.

## Browser capabilities

Speech recognition and installed voices are browser/device features. Chrome and Edge have the most reliable microphone transcription support. Captions remain available if a listener's device lacks a suitable installed voice.
