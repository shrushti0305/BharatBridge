# 📡 BharatBridge — Real-Time WebSocket Protocol & Language Room Architecture

> **Protocol Rule**: All binary & text payloads are routed via Language Rooms (`session:{id}:language:{code}`) to optimize broadcast scalability ($1\text{ NMT} + 1\text{ TTS} \implies N\text{ Listeners}$).

---

## 1. Language Room Architecture

```text
Speaker (English)
   │
   ▼
Node WebSocket Server (Port 3000)
   ├──► Session Room: session:582941
   │
   ├──► Hindi Room (session:582941:language:hi)
   │      ├─ 1 Hindi Translation (Gemini)
   │      ├─ 1 Hindi TTS Stream (Smallest.ai radhika)
   │      └─ Broadcast to 100 Hindi Listeners
   │
   └──► Marathi Room (session:582941:language:mr)
          ├─ 1 Marathi Translation (Gemini)
          ├─ 1 Marathi TTS Stream (Smallest.ai diya)
          └─ Broadcast to 50 Marathi Listeners
```

---

## 2. Client → Server Event Schemas

### A. Join Session (`join`)
```json
{
  "type": "join",
  "sessionId": "582941",
  "role": "speaker",
  "gender": "female",
  "targetLang": "hi"
}
```

### B. Speaker Text Broadcast (`text_translation`)
```json
{
  "type": "text_translation",
  "originalText": "Welcome to today's conference on artificial intelligence.",
  "sourceLang": "en",
  "targetLang": "hi",
  "isFinal": true
}
```

---

## 3. Server → Client Event Schemas

### A. Listener Transcription Envelope (`transcription`)
```json
{
  "type": "transcription",
  "sessionId": "582941",
  "sequenceNumber": 14,
  "originalText": "Welcome to today's conference on artificial intelligence.",
  "translatedText": "आर्टिफिशियल इंटेलिजेंस पर आज के सम्मेलन में आपका स्वागत है।",
  "sourceLang": "en",
  "targetLang": "hi",
  "isFinal": true,
  "timestamp": 1758734912000
}
```

### B. Audio Chunk Payload (`audio`)
```json
{
  "type": "audio",
  "sessionId": "582941",
  "sequenceNumber": 14,
  "sourceLanguage": "en",
  "targetLanguage": "hi",
  "audio": "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA...",
  "format": "audio/mp3",
  "timestamp": 1758734912100,
  "provider": "smallest-waves"
}
```

### C. Live Telemetry & Listener Count (`stats`)
```json
{
  "type": "stats",
  "sessionId": "582941",
  "listeners": 150,
  "telemetry": {
    "sttMs": 300,
    "translationMs": 340,
    "ttsMs": 85,
    "totalEndToEndMs": 792
  }
}
```

### D. Full Session History (`history`)
```json
{
  "type": "history",
  "sessionId": "582941",
  "messages": [
    {
      "originalText": "Good morning.",
      "translatedText": "सुप्रभात।",
      "sourceLang": "en",
      "targetLang": "hi",
      "timestamp": 1758734900000
    }
  ]
}
```
