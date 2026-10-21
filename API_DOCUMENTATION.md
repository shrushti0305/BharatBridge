# 📖 BharatBridge Production API Specification

> **BASE URL**: `http://localhost:3000` (Local) / `https://your-domain.com` (Production)

---

## 1. System Health Endpoints

### `GET /api/health`
Returns system operational status and configured storage flags.

**Response**:
```json
{
  "status": "ok",
  "mode": "development",
  "azureStorageConfigured": true
}
```

### `GET /api/health/providers`
Returns health & configuration status of all registered AI provider adapters without exposing secrets.

**Response**:
```json
{
  "translation": {
    "gemini": true,
    "azure": true,
    "bhashini": false
  },
  "tts": {
    "smallest": true,
    "azure": true,
    "google": true
  }
}
```

---

## 2. Real-Time Translation API

### `POST /api/translate`
Translates source text into target language using context-aware LLM with automatic fallback cascade.

**Request Body**:
```json
{
  "text": "Welcome to today's keynote speech.",
  "sourceLanguage": "English",
  "targetLanguage": "Hindi",
  "context": [
    { "originalText": "Hello everyone.", "translatedText": "नमस्कार सर्वांना." }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "translatedText": "आज के मुख्य भाषण में आप सभी का स्वागत है।",
  "provider": "gemini-2.5-flash",
  "executionTimeMs": 340
}
```

---

## 3. Neural Voice Synthesis API

### `POST /api/azure/tts`
Synthesizes translated text into high-fidelity streaming audio buffer (Base64 MP3).

**Request Body**:
```json
{
  "text": "आज के मुख्य भाषण में आप सभी का स्वागत है।",
  "languageCode": "hi-IN",
  "voiceName": "hi-IN-SwaraNeural"
}
```

**Response**:
```json
{
  "success": true,
  "audio": "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAD...",
  "format": "audio/mp3",
  "provider": "smallest-waves",
  "executionTimeMs": 85
}
```

---

## 4. AI Session Summary API

### `POST /api/session-summary`
Generates structured executive summary markdown from session transcript.

**Request Body**:
```json
{
  "sessionId": "session_582941",
  "targetLanguage": "English",
  "messages": [
    { "originalText": "Good morning everyone.", "translatedText": "Good morning everyone." }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "summary": "# Session Summary (ID: session_582941)\n## Executive Overview\nKeynote conference covering Pan-India translation scaling.\n## Key Highlights\n- Live continuous STT demonstration\n- Zero-overlap voice audio playback"
}
```
