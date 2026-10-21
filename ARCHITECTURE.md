# 🏗️ BharatBridge Modular Architecture Specification

> **VERSION**: v4.2 Production  
> **ARCHITECTURE**: Provider-Decoupled Multi-Tier AI Matrix & Low-Latency WebSocket Gateway  

---

## 1. System Overview

BharatBridge is built as a modular real-time speech translation platform. Business logic communicates strictly with normalized provider interfaces rather than direct vendor SDK calls:

```
                          ┌─────────────────────────────┐
                          │   BHARATBRIDGE CORE LOGIC   │
                          └──────────────┬──────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌──────────────┐                 ┌──────────────┐                 ┌──────────────┐
│  STTProvider │                 │  Translation │                 │  TTSProvider │
│  Interface   │                 │  Interface   │                 │  Interface   │
└───────┬──────┘                 └───────┬──────┘                 └───────┬──────┘
        │                                │                                │
        ▼                                ▼                                ▼
  WebSpeech API                    Gemini 2.5 Flash               Smallest.ai Waves
  (Browser STT)                    Azure Translator               Azure Neural TTS
                                   Bhashini NMT                   Google Neural TTS
```

---

## 2. Decoupled Provider Interfaces

### 1. Translation Provider Interface (`ITranslationProvider`)
* **Primary**: `GeminiTranslationProvider` (Rolling 4-sentence context prompt memory)
* **Fallback**: `AzureTranslationProvider` (Azure Translator REST API)
* **Regional Fallback**: `BhashiniTranslationProvider` (AI4Bharat MeitY Government of India NMT API)

### 2. TTS Provider Interface (`ITTSProvider`)
* **Primary**: `SmallestTTSProvider` (Sub-100ms ultra-fast streaming voice synthesis)
* **Secondary**: `AzureTTSProvider` (Enterprise High-Fidelity Regional Neural Voices)
* **Emergency**: `GoogleTTSProvider` (Universal Google Neural TTS fallback)

### 3. Session Context Manager (`ConversationContextManager`)
* Enforces strict session-isolated rolling 4-sentence prompt memory.
* Guarantees zero context leakage between different live sessions (Session A memory never leaks into Session B).

### 4. Storage Provider Interface (`IStorageProvider`)
* **Firestore**: Real-time session state & message collections (`sessions/{id}/messages`).
* **Azure Blob Storage**: Asynchronous dual-format JSON and UTF-8 BOM CSV (`\uFEFF`) cloud backups.

---

## 3. Real-Time WebSocket Gateway Protocol

All real-time communications utilize normalized JSON envelopes:

```json
{
  "type": "transcription",
  "sessionId": "session_123",
  "requestId": "req_abc456",
  "timestamp": 1727150000000,
  "payload": {
    "sequence": 42,
    "originalText": "Welcome to today's conference.",
    "translatedText": "आजच्या परिषदेत तुम्हा सर्वांचे स्वागत आहे.",
    "sourceLang": "en",
    "targetLang": "mr",
    "isFinal": true,
    "metrics": {
      "sttMs": 300,
      "translationMs": 350,
      "ttsMs": 90,
      "totalMs": 790
    }
  }
}
```

---

## 4. Latency Target Budget (< 1.5 Seconds)

* **STT Phrase Boundary Detection**: `< 300 ms`
* **Gemini LLM Context Translation**: `300 ms – 500 ms`
* **Smallest.ai Waves TTS Synthesis**: `70 ms – 200 ms`
* **WebSocket Transport Hop**: `< 50 ms`
* **Listener Playback Startup**: `< 100 ms`
* **TARGET END-TO-END LATENCY**: **< 1,250 ms (1.25s)**
