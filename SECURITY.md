# BharatBridge v4.2 — Security & Data Protection Specification

## 1. Security Architecture Principles
BharatBridge implements strict zero-trust security controls across network transport, API integration, and data storage.

```
[ Client App (Vite/React) ]
         │
         │ WSS / HTTPS (TLS 1.3) — ZERO API Keys in Client
         ▼
[ Express Server Proxy (Node.js) ]
         │
         ├─► [ Gemini API ] (Server-side GEMINI_API_KEY)
         ├─► [ Smallest.ai ] (Server-side SMALLEST_API_KEY)
         ├─► [ Azure Speech/Translator ] (Server-side AZURE_KEY)
         └─► [ Azure Blob Storage ] (Server-side Connection String)
```

---

## 2. API Key Protection Policy
- **ZERO Client Exposure**: Neither Gemini API keys, Smallest.ai keys, nor Azure credentials are sent to or stored in client JavaScript.
- **Backend Proxied Endpoints**: All AI/ML API calls route through server endpoints (`/api/translate`, `/api/azure/tts`, `/api/azure/upload-caption`, `/api/session-summary`).
- **Environment Isolation**: `.env` files are excluded from version control (`.gitignore`).

---

## 3. WebSocket Security
- **Transport**: WSS (WebSocket Secure) over TLS 1.3 in production environments.
- **Session Isolation**: WebSockets are logically partitioned by `sessionId` and target language rooms (`session:{id}:lang:{code}`).
- **Input Sanitization**: Incoming speaker audio chunks and text frames are validated for size and type before processing.

---

## 4. Firestore Security Rules Matrix
- **Session Read Access**: Public read access to active session metadata for room discovery.
- **Speaker Write Controls**: Speaker transcripts require valid session initialization (`speakerId` attribution).
- **Data Protection**: Deletion of session logs is restricted to platform admin role.

---

## 5. Compliance & Data Privacy
- **Transient Audio Processing**: Audio PCM frames processed by STT and TTS engines are processed transiently in-memory and deleted immediately after synthesis.
- **Storage Encryption**: Captions archived to Azure Blob Storage are encrypted at rest via AES-256 (Azure Storage Service Encryption).
