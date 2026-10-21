# BHARATBRIDGE — BASELINE WORKING STATE TECHNICAL SPECIFICATION

**Status**: WORKING (Verified End-to-End Live Translation Pipeline)  
**Date**: September 25, 2026  
**Version**: v4.2 Baseline  

---

## 1. Status & Core Pipeline Verification Matrix

| Pipeline Stage | Status | Verification Detail |
| :--- | :--- | :--- |
| **STT (Speech-to-Text)** | **PASS** | Captured via Web Speech API (`SpeechRecognition`) on Panelist client; interim and final sentence segmentation functional. |
| **Translation Request** | **PASS** | Sent via HTTP `POST /api/translate` to Node.js backend. |
| **Translation Execution** | **PASS** | Server executes `generateTranslationWithGemini` using `@google/genai` (Gemini API). |
| **WebSocket Inbound Send** | **PASS** | Panelist sends `text_translation` frame over WebSocket to backend. |
| **Server WS Authorization** | **PASS** | Server validates `currentRole` (`organizer`, `speaker`, `panelist`) against `session.panelists` registry. |
| **WebSocket Broadcast** | **PASS** | Server broadcasts `transcription` frames to listeners in target language groups. |
| **Listener Inbound Receive** | **PASS** | Listener WS receives `transcription` frame with speaker attribution (`speakerId`, `speakerName`). |
| **TTS Request** | **PASS** | Listener client issues `POST /api/azure/tts` REST request. |
| **TTS Synthesis** | **PASS** | Server synthesizes neural audio via Azure Speech REST API with Google TTS fallback. |
| **Audio Playback** | **PASS** | Listener client queues base64 MP3 and plays via `HTMLAudioElement`. |

---

## 2. Current Working Architecture

BharatBridge operates on a **hybrid client-server architecture**:
* **Client Side (React / Vite)**: Captures audio, handles STT via browser APIs, manages local audio queues, renders role-aware UI controls, and plays synthesized TTS audio.
* **Server Side (Node.js / Express / WS)**: Serves translation and TTS REST APIs, orchestrates AI providers (Gemini, Azure Speech, Google TTS), maintains session state, handles role authorization, and routes real-time WebSocket speech broadcasts across language groups.

```
Panelist Microphone
       │ (MediaDevices / SpeechRecognition)
       ▼
Finalized Transcript Sentence
       │
       ├──► POST /api/translate ──► Gemini AI ──► Translated Text
       │
       ▼
WebSocket text_translation Frame
       │
       ▼
Server WebSocket Handler (server.ts)
       │ (Validates session.panelists registration)
       │ ├── Primary Language Group Broadcast
       │ └── Secondary Language Group Async Translation & Broadcast
       ▼
Listener WebSocket transcription Frame
       │
       ▼
POST /api/azure/tts ──► Azure Neural / Google TTS ──► Base64 Audio Stream
       │
       ▼
HTMLAudioElement Playback Queue (Listener Headphones / Speaker)
```

---

## 3. Complete Data Flow (Spoken Sentence Trace)

1. **Audio Capture**: Panelist speaks; `SpeechRecognition` processes audio stream and emits `onresult` events.
2. **STT Finalization**: `res.isFinal === true` triggers `enqueueSpokenSentence` $\rightarrow$ `processSentenceQueue`.
3. **Translation REST Request**: Client invokes `POST /api/translate` with `{ text, sourceLanguage, targetLanguage }`.
4. **Gemini Translation**: Server calls `generateTranslationWithGemini` and returns `{ translatedText }`.
5. **WebSocket Frame Send**: Panelist sends `text_translation` frame containing `originalText`, `translatedText`, `sourceLang`, and `targetLang`.
6. **Server WS Validation & Attribution**: Server checks socket against `session.panelists`, attaches `speakerId` (`speaker-01` .. `speaker-10`) and `speakerName`.
7. **Broadcast**: Server routes `transcription` frame to all connected listener sockets in target language groups.
8. **Listener UI Update**: Listener client receives `transcription` frame, appends attributed transcript card to feed, and updates live output.
9. **TTS REST Request**: Listener client calls `POST /api/azure/tts` with translated text and target language code.
10. **TTS Synthesis**: Server generates audio binary via Azure Speech SSML (or Google TTS fallback) and returns base64 string.
11. **Audio Queue & Playback**: Listener client converts base64 string into `data:audio/mp3;base64,...` URL and plays via `HTMLAudioElement`.

---

## 4. WebSocket Role & Authorization Model

### Canonical Roles
* `ORGANIZER`: Room creator / host. Possesses session administrative control and default `speaker-01` broadcast authority.
* `PANELIST`: Approved speaker occupying one of 10 panelist slots (`speaker-01` .. `speaker-10`). Authorized to originate live speech translations.
* `LISTENER`: Passive participant. Subscribed to translated captions and audio streams for a chosen target language.

### Server Authorization Enforcements
* **Session Ownership**: A session is created upon host join. The host socket is recorded as `session.organizerWs` and assigned `speaker-01` in `session.panelists`.
* **Inbound Frame Validation**:
  ```ts
  const panelist = Array.from(session.panelists.values()).find(p => p.ws === ws);
  const socketRole = (ws as any).currentRole || currentRole;
  const isAuthorizedSpeaker = !!panelist || socketRole === "speaker" || socketRole === "organizer" || socketRole === "PANELIST" || socketRole === "panelist";
  ```
  Unregistered sockets attempting to send `text_translation` or `audio` frames are rejected and logged.
* **Role Synchronization**:
  * **Organizer Join**: Socket initialized with `currentRole = "organizer"` and added to `session.panelists` as `speaker-01`.
  * **Speaker Request Approval**: Server updates socket state `(reqItem.ws as any).currentRole = "speaker"`, assigns slot `speaker-02` .. `speaker-10`, and emits `role_changed`.
  * **Demotion to Listener**: Server removes slot from `session.panelists`, resets socket state `currentRole = "listener"`, and emits `role_changed`.

---

## 5. Speaker Slot Assignment Algorithm

1. Host joins session $\rightarrow$ Server assigns `speaker-01`.
2. Listener sends `speaker_request` $\rightarrow$ Added to `session.pendingRequests`.
3. Organizer sends `speaker_approval` (`approved = true`).
4. Server evaluates `session.panelists.size < 10`.
5. Server iterates candidate slots `speaker-01` through `speaker-10` to locate the first available slot:
   ```ts
   for (let i = 1; i <= 10; i++) {
     const candidateSlot = `speaker-${i < 10 ? '0' + i : i}`;
     if (!session.panelists.has(candidateSlot)) {
       assignedSlot = candidateSlot;
       break;
     }
   }
   ```
6. Slot mapping stored in `session.panelists.set(assignedSlot, { speakerId: assignedSlot, userId, userName, ws })`.

---

## 6. Provider Specifications

### STT Provider
* **Primary**: Browser Native Web Speech API (`window.SpeechRecognition` / `webkitSpeechRecognition`).
* **Mode**: Continuous (`continuous = true`), Interim Results (`interimResults = true`).
* **Language Code**: Scaled dynamically based on selected source language (e.g. `en-IN`, `hi-IN`, `mr-IN`).

### Translation Provider
* **Primary Engine**: Google Gemini API (`gemini-2.5-flash` via `@google/genai`).
* **Fallback Engine 1**: Azure Translator REST API (if `AZURE_TRANSLATION_KEY` present).
* **Fallback Engine 2**: Bhashini ULCA Translation API.
* **Emergency Fallback**: Universal Google Translate GTX endpoint / Raw text passthrough.

### TTS Provider
* **Primary Engine**: Azure Cognitive Services Neural Text-to-Speech (`https://<region>.tts.speech.microsoft.com/cognitiveservices/v1`).
* **Fallback Engine 1**: Google Neural TTS endpoint (`https://translate.google.com/translate_tts`).
* **Fallback Engine 2**: Browser Native `window.speechSynthesis` (`SpeechSynthesisUtterance`).

---

## 7. Firebase & Persistence Integration

* **Configuration**: Credentials specified in `firebase-applet-config.json` (Project ID: `reflecting-journey-d8gvj`).
* **Auth**: Firebase Auth (`getAuth`) with Google Auth Provider (`GoogleAuthProvider`).
* **Firestore**: `sessions/{sessionId}/messages` collection used for cloud message persistence.
* **Non-blocking Behavior**: In-memory WebSocket architecture handles real-time sessions independently of Firestore database availability.

---

## 8. API & WebSocket Specifications

### REST API Endpoints
* `POST /api/translate`: Accepts `{ text, sourceLanguage, targetLanguage, context }`, returns `{ translatedText }`.
* `POST /api/azure/tts`: Accepts `{ text, languageCode, voiceName }`, returns `{ audio: "<base64_mp3>", format: "audio/mp3" }`.
* `POST /api/session-summary`: Accepts `{ sessionId, messages, targetLanguage }`, returns AI session summary.
* `GET /api/health`: Returns server status, active session counts, and system uptime.

### WebSocket Frame Types
* `join`: Client requests to join a room as `organizer`, `speaker`, or `listener`.
* `speaker_request`: Listener requests organizer approval to speak.
* `speaker_approval`: Organizer approves/rejects a pending listener request.
* `role_changed`: Server notifies client of authoritative role transition.
* `switch_to_listener`: Panelist requests demotion back to listener role.
* `text_translation`: Panelist sends finalized text translation to server.
* `transcription`: Server broadcasts attributed translated text to listeners.
* `room_state`: Server broadcasts active 10-panelist roster and pending request queue.
* `stats`: Server broadcasts listener count updates.

---

## 9. Major Components Architecture

### Frontend (`src/App.tsx`)
* **State Management**: React state (`userRole`, `sessionRole`, `speakerSlot`, `messages`, `panelistRoster`, `pendingSpeakerRequests`).
* **Audio Engine**: `enqueueTtsPlayback`, `processTtsQueue`, `playSingleAudioChunk` (HTMLAudioElement management), `playSingleWebSpeech`.
* **STT Controller**: `SpeechRecognition` lifecycle, queue deduplication (`enqueueSpokenSentence`), interim drawer update.

### Backend (`server.ts`)
* **Express HTTP Server**: Serves REST endpoints (`/api/translate`, `/api/azure/tts`, `/api/health`).
* **WebSocket Server (`ws`)**: Manages room map `sessions`, handles connection state, executes role authorization checks, performs secondary language group translation, and broadcasts real-time payloads.

---

## 10. Environment Variables

```env
PORT=3000
GEMINI_API_KEY=<google_gemini_api_key>
AZURE_SPEECH_KEY=<azure_speech_service_key>
AZURE_SPEECH_REGION=centralindia
AZURE_TRANSLATION_KEY=<azure_translator_key>
AZURE_TRANSLATION_REGION=centralindia
BHASHINI_USER_ID=<bhashini_user_id>
BHASHINI_API_KEY=<bhashini_api_key>
BHASHINI_PIPELINE_ID=<bhashini_pipeline_id>
```

---

## 11. Known Limitations & Observed Behaviors

1. **Browser Autoplay Policy**: Browsers (Chrome, Edge, Safari) restrict unprompted audio playback until the user interacts with the page (at least one click/tap).
2. **Web Speech API Coverage**: Speech-to-Text requires Chrome or Chromium-based browsers for full native `webkitSpeechRecognition` support.
3. **Multi-Language Secondary Delay**: Translating secondary target languages asynchronously introduces ~200-400ms translation latency per additional active language group.

---

## 12. Recent Fix Log (WebSocket Role Authorization)

* **Files Modified**:
  - [`server.ts`](file:///D:/AI%20DS%20CYDA%20documents/bharatbridge/Bharat-Bridge/server.ts)
  - [`src/services/api.ts`](file:///D:/AI%20DS%20CYDA%20documents/bharatbridge/Bharat-Bridge/src/services/api.ts)
  - [`src/App.tsx`](file:///D:/AI%20DS%20CYDA%20documents/bharatbridge/Bharat-Bridge/src/App.tsx)
* **Fix Description**: Resolved WebSocket role desynchronization where `currentRole === "organizer"` caused `text_translation` frames to be dropped by `server.ts`. Updated authorization to check server-authoritative `session.panelists` registry and synchronized connection role state across join, approval, and demotion events.
