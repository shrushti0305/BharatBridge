# 🔍 BharatBridge Low-Latency Architecture Audit & Benchmark Specification

> **PROJECT**: BharatBridge (v4.2)  
> **AUDIT TIMESTAMP**: September 24, 2026  
> **ENGINEERING PRIORITY**: Sub-1.5-Second End-to-End Latency & Low-Overhead Multi-Tier AI Provider Decoupling  

---

## 🏗️ 1. Current Architecture Overview

BharatBridge is a real-time multilingual live translation web platform connecting event speakers with listeners across 22 scheduled Indian languages + English. 

* **Frontend**: React 19.0.1, TypeScript 5.8.2, Tailwind CSS 4.1.14, Framer Motion, Lucide React, Vite 6.2.3.
* **Backend**: Node.js runtime, Express 4.21.2, TypeScript (`tsx` execution engine), `ws` 8.21.3 WebSocket server.
* **AI Providers**:
  * **Translation**: Google Gemini API (`@google/genai` models `gemini-2.5-flash` / `gemini-2.0-flash`) with rolling 4-sentence context memory + Azure Translator API & Universal Google Translate fallback.
  * **Voice Synthesis (TTS)**: Smallest.ai Waves API (`https://waves-api.smallest.ai/api/v1/lightning/get_speech`) + Azure Cognitive Services Neural Speech (`hi-IN-SwaraNeural`, `mr-IN-AarohiNeural`, etc.) + Google Neural TTS fallback.
  * **Speech-to-Text (STT)**: Browser native Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) with word-by-word streaming preview and 4-second deduplication lock window.
* **Persistence & Cloud Storage**:
  * **Firebase Cloud Firestore**: Real-time session status tracking, listener credentials, and message subcollections governed by `firestore.rules`.
  * **Azure Blob Storage**: Dual-format structured JSON and UTF-8 BOM CSV (`\uFEFF`) caption exports via `@azure/storage-blob`.

---

## 🔄 2. Current Data Flow & Execution Pipeline

```
[ Speaker Microphone ]
        │
        ▼ (Continuous Browser Speech Capture)
[ 1. Web Speech STT Engine ] ──► (Word-by-Word Streaming Preview)
        │
        ▼ (Finalized Phrase / Sentence Boundary)
[ 2. WebSocket Gateway (wss://) ]
        │
        ▼ (Express Server server.ts)
[ 3. Context-Aware Gemini Translation ] ──► (Fallback: Azure / Google Translate)
        │
        ▼ (Target Translated Text)
[ 4. Smallest.ai Waves / Azure TTS ] ──► (Sub-100ms Base64 Audio Synthesis)
        │
        ▼ (Monotonically Increasing Sequence Packet)
[ 5. WebSocket Language Room Router ]
        │
        ├─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
  (Hindi Room)             (Marathi Room)            (Tamil Room)
        │                         │                         │
        ▼                         ▼                         ▼
[ Listener Audio Queue ]  [ Listener Audio Queue ]  [ Listener Audio Queue ]
(Sequence Sorted Playback) (Sequence Sorted Playback)(Sequence Sorted Playback)
```

---

## 🚨 3. Existing Bottlenecks & Problems Identified

1. **Lack of Per-Stage Latency Measurement**:
   - Current pipeline logs execution time in console warnings, but lacks explicit per-stage timestamp metrics (`sttLatency`, `translationLatency`, `ttsLatency`, `websocketLatency`, `totalPipelineLatency`) embedded in the client payload.
2. **Monolithic Server Structure**:
   - `server.ts` contains express app setup, vite middleware, REST API handlers, WebSocket upgrade logic, room management, and AI provider calls in one file. Refactoring into modular subfolders (`src/providers/*`, `src/services/*`, `src/websocket/*`) will eliminate tight coupling.
3. **Absence of Audio Packet Sequence Numbers**:
   - WebSocket audio payloads currently lack monotonically increasing `sequence` IDs (`sequence: 1, 2, 3...`), which can cause jitter or out-of-order playback under high mobile network latency.
4. **Synchronous Persistence Overhead**:
   - Azure Blob Storage uploads and Firestore writes must remain strictly asynchronous off the critical WebSocket audio/caption fan-out path.

---

## 🎯 4. Latency Benchmarks & Targets

To achieve the engineering goal of **sub-1.5-second end-to-end latency**, BharatBridge will enforce the following per-stage latency budgets:

| Pipeline Stage | Target Latency Budget | Provider / Strategy |
| :--- | :--- | :--- |
| **STT Phrase Finalization** | **< 300 ms** | Browser Web Speech API phrase boundary detection |
| **Translation Layer** | **300 ms – 500 ms** | Gemini 2.5 Flash / 2.0 Flash with rolling context |
| **TTS First-Audio Synthesis** | **70 ms – 200 ms** | Smallest.ai Waves API (Primary) / Azure Neural Speech |
| **WebSocket Network Hop** | **< 50 ms** | Native TCP WebSockets (`wss://`) port 443 |
| **Listener Playback Startup** | **< 100 ms** | Non-overlapping sequence queue buffer (`AudioContext`) |
| **TOTAL PIPELINE LATENCY** | **< 1,250 ms (1.25s)** | **Target: Sub-1.5 Seconds** |

---

## 📁 5. File Modification Strategy

### Files to Modify / Create (Modular Refactoring)
* **`server.ts`**: Refactor to import modular routes, WebSocket router, and provider orchestrators.
* **`src/config/env.ts`**: Centralized environment variable loader and provider routing switches.
* **`src/types/provider.ts`**: Normalized request/response data models and provider interfaces.
* **`src/types/websocket.ts`**: Standardized WebSocket envelope & sequence payloads.
* **`src/providers/translation/*`**: `GeminiTranslationProvider`, `AzureTranslationProvider`, `BhashiniTranslationProvider`.
* **`src/providers/tts/*`**: `SmallestTTSProvider`, `AzureTTSProvider`, `GoogleTTSProvider`.
* **`src/services/context.ts`**: Session-isolated rolling 4-sentence context manager.
* **`src/services/observability.ts`**: Latency timing logger and benchmark metrics collector.
* **`src/websocket/gateway.ts`**: Sequence-numbered WebSocket room router.
* **`src/App.tsx`**: Add sequence-sorted audio playback queue and developer latency dashboard overlay.

### Files to Keep Unchanged
* **`vite.config.ts`**: Vite bundler settings and HMR configuration.
* **`tsconfig.json`**: Compiler configuration.
* **`index.html`**: Font imports and root DOM container.
* **`src/languages.ts`**: 22 Indian language metadata registry.
* **`firestore.rules`**: Firestore security rules and authorization constraints.

---

## 🗓️ 6. 13-Phase Low-Latency Implementation Plan

1. **Phase 0**: Codebase Audit & Architecture Freeze (`ARCHITECTURE_AUDIT.md` - Complete).
2. **Phase 1**: Streaming STT Phrase Boundary Optimization.
3. **Phase 2**: Translation Provider Decoupling & Gemini Flash Integration.
4. **Phase 3**: Low-Latency TTS Integration (Smallest.ai Waves Sub-100ms).
5. **Phase 4**: Sequence-Numbered WebSocket Gateway & Room Fan-Out.
6. **Phase 5**: Sequence-Sorted Listener Audio Queue (Zero Overlap).
7. **Phase 6**: Asynchronous End-to-End Pipeline Interleaving.
8. **Phase 7**: Non-Blocking Asynchronous Storage & Summary Detachment.
9. **Phase 8**: Per-Stage Latency Monitoring & Timestamp Envelope.
10. **Phase 9**: Latency Optimization Benchmarking (<1.5s Target).
11. **Phase 10**: Automatic Multi-Tier Fallback & Failure Recovery.
12. **Phase 11**: Security & Key Protection Audit.
13. **Phase 12 & 13**: Automated Mock Testing & Documentation Suite (`ARCHITECTURE.md`, `API_DOCUMENTATION.md`, `WEBSOCKET_PROTOCOL.md`, `LATENCY_REPORT.md`).
