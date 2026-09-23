# 🧊 BharatBridge v4.2 — Official Architecture Freeze Specification

> **STATUS: ARCHITECTURE FROZEN**  
> **TIMESTAMP**: September 23, 2026  
> **VERSION**: v4.2 (Production Stable)

---

## 🔒 1. Frozen Core Principles & Guarantees

1. **INSTANT ZERO-BLOCKING WEBSOCKET STREAMING**:
   - WebSocket room routing and sub-1ms PIN verification (`582941`).
   - History catch-up payload (`type: "history"`) delivered to joining listeners in `<50ms`.

2. **CONTEXT-AWARE LLM TRANSLATION**:
   - Google Gemini 2.5 Flash / 2.0 Flash (`@google/genai`) with rolling 4–6 sentence prompt memory.
   - Zero word-for-word literal translation. Preserves natural Indian language grammar, idioms, and context.

3. **STRICT SPEAKER VS. LISTENER ROLE ISOLATION**:
   - **Speaker View**: Raw spoken captions only. Zero target translation text or target TTS audio sent to speaker to prevent distraction.
   - **Listener View**: Receives live target contextual translation captions + sequential TTS audio voice in their selected single target language.

4. **NON-BLOCKING STT & ZERO-OVERLAP TTS**:
   - **STT**: Continuous Web Speech API with 4-second deduplication lock window (`lastProcessedSentenceRef`).
   - **TTS**: Single active HTMLAudioElement (`activeAudioElRef`) driven by an `onended` Promise queue (`processTtsQueue`). Strictly 1 active voice playback with 0 voice overlap.

5. **CLEAN 2-COLUMN MINIMALIST UI**:
   - 2-column layout (Left: Original Speech Captions | Right: Target Translation Output).
   - Top banner displaying active PIN, listener count, WAV audio recording, UTF-8 BOM CSV exports, and Gemini AI Session Summaries.

6. **GUEST MODE & DUAL-FORMAT PERSISTENCE**:
   - 100% Guest Mode accessibility without mandatory logins.
   - Dual-format caption logs in raw JSON and UTF-8 BOM (`\uFEFF`) CSV for native Microsoft Excel Devanagari rendering.

---

## 🏗️ 2. Frozen Tech Stack Baseline

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS 4, Motion/Framer, Lucide Icons.
- **Backend**: Node.js, Express.js, TypeScript (`tsx`), WebSockets (`ws`).
- **AI LLM Engine**: Google Gemini 2.5 Flash / 2.0 Flash (`@google/genai`).
- **Speech Engine**: Azure Cognitive Services Speech Neural Voices (`hi-IN-SwaraNeural`, `mr-IN-AarohiNeural`, `ta-IN-PallaviNeural`, etc.) + Google Neural TTS Fallback.
- **Storage & Database**: Azure Blob Storage + Firebase Cloud Firestore.
- **Network Resolution**: Forced IPv4 DNS Priority (`dns.setDefaultResultOrder("ipv4first")`).

---

## 🌐 3. Active Deployment Endpoints

- **Local Host**: `http://localhost:3000`
- **Wi-Fi LAN**: `http://192.168.1.75:3000`
- **Public HTTPS Link**: `https://rotten-pens-tell.loca.lt`
- **Developer PDF Blueprint**: `BharatBridge_Technical_Specification.pdf`
