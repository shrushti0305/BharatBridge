# PROJECT

## 1. Project Overview

* **Project Name**: BharatBridge (v4.2)
* **Purpose**: BharatBridge is a live, enterprise-grade multilingual translation platform engineered for Pan-India conferences, webinars, and public events. It enables real-time continuous speech-to-text (STT), context-aware AI neural translation across 22 scheduled Indian languages plus English, and zero-overlap single-queue text-to-speech (TTS) synthesis for audience members.
* **Problem Being Solved**: Language barriers in diverse public and corporate gatherings across India. Traditional human interpretation is expensive, non-scalable, and limited in language coverage. BharatBridge eliminates these barriers by allowing speakers to present naturally in their chosen native language while listeners independently select and receive live translated captions and neural audio in their preferred target language.
* **Target Users**:
  * **Event Speakers / Presenters**: Create live translation sessions, speak naturally into their microphone, view real-time raw speech previews, monitor listener analytics, and generate session summaries.
  * **Event Listeners / Audience**: Join sessions effortlessly via room PIN or QR code scanning, select their individual target language, view live translated captions, and hear clear, zero-overlap synthesized audio.
  * **Event Administrators**: Audit active/historical sessions, review message logs, export multi-format transcripts (JSON, CSV, WAV, TXT), and manage system settings.
* **Current Project Status**: Production-Ready / Architecture Frozen (v4.2). Active development server running locally on port 3000, supporting dual-version isolation (V1 baseline on port 3001).

---

## 2. Product Requirements

* **Real-Time Continuous Speech Capture**: Provide instant, continuous microphone speech recognition for the speaker with zero manual button pressing per sentence.
* **Live Word-by-Word Preview**: Display real-time streaming speech preview for the speaker while isolating complete sentence completion before triggering translation.
* **Context-Aware Multilingual Translation**: Translate spoken content into target Indian languages using rolling conversation memory to maintain proper grammar, honorifics, and cultural context instead of literal word-for-word substitutions.
* **Strict Role Isolation**:
  * **Speaker Interface**: Shows only the speaker's original language captions. No target translation text or TTS playback is routed to the speaker.
  * **Listener Interface**: Receives target language translation captions and audio streams matching the listener's selected target language.
* **Single Target Language Enforcement**: Guarantee that each listener receives translated output strictly in their chosen target language, with seamless dynamic language switching.
* **Zero-Overlap Sequential Audio Playback**: Queue generated TTS audio chunks and play them sequentially without overlapping or cutting off preceding sentences.
* **Multi-Format Transcript Export**: Enable export of session transcripts in plain text (`.txt`), downloadable raw audio (`.wav`), structured `.json`, and Microsoft Excel-compatible UTF-8 BOM `.csv`.
* **AI Executive Summarization**: Generate structured AI executive summaries containing key highlights and chronological takeaways at the end of a session.
* **Seamless Guest Access**: Allow immediate session joining and creation without mandatory user registration, while providing optional Google OAuth and custom profile credentials.

---

## 3. Current Implementation

### Currently Implemented
* **Continuous Speech Recognition**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) with automated restart handlers and a 4-second deduplication lock window.
* **Contextual AI Translation Engine**: Google Gemini API (`@google/genai` using `gemini-2.5-flash`, `gemini-2.0-flash`, and `gemini-1.5-flash`) with rolling 4–6 sentence prompt context.
* **Multi-Tier Translation Fallback**: Automated fallback chain: Google Gemini AI -> Universal Google Translate API (`translate.googleapis.com`) -> Azure Cognitive Services Translator API -> Raw text fallback.
* **Multi-Tier TTS Engine**: Azure Cognitive Services Neural Voices (`hi-IN-SwaraNeural`, `mr-IN-AarohiNeural`, `ta-IN-PallaviNeural`, etc.) -> Universal Google Neural TTS -> Local browser `SpeechSynthesisUtterance`.
* **WebSocket Communication Server**: Node.js `ws` server handling `join`, `audio`, `text_translation`, `transcription`, `stats`, `history`, and `interrupted` events.
* **State & Persistence**:
  * **Firebase Cloud Firestore**: Session creation (`sessions`), session status tracking, message history (`sessions/{id}/messages`), and user preferences.
  * **Azure Blob Storage**: Automated dual-format upload of session transcripts (`.json` and UTF-8 BOM `.csv`) via `@azure/storage-blob`.
* **UI & Experience**: React 19 + Tailwind CSS 4 responsive 2-column layout with Framer Motion animations, Lucide icons, live audio visualizer, QR code overlay, and AI summary modal.
* **Guest & Auth Modes**: 100% Guest mode operational pathway alongside Google OAuth via Firebase Auth and custom profile login modal.

### Partially Implemented
* **Raw PCM Audio Streaming via WebSocket**: Server receives PCM audio frames (`message.type === "audio"`) and maintains stubbed interfaces for Gemini Live WebSocket connection (`ai.live.connect`), though text translation + TTS APIs serve as the active production speech pipeline.

### Planned / Future
* Multi-speaker simultaneous broadcast within a single room.
* Offline standalone desktop/edge deployment bundle.
* Native iOS and Android mobile applications.

### Not Implemented
* Automated unit, integration, or end-to-end test suites (e.g. Jest, Vitest, Playwright).

---

## 4. Technology Stack

* **Frontend Framework**: React 19.0.1
* **Frontend Build Tool**: Vite 6.2.3
* **Programming Languages**: TypeScript 5.8.2, JavaScript (ES Module)
* **Styling & UI**: Tailwind CSS 4.1.14, Motion 12.23.24 (Framer Motion), Lucide React 0.546.0
* **Backend Runtime**: Node.js with Express 4.21.2 and `tsx` 4.21.0
* **Backend Bundler**: `esbuild` 0.28.2
* **Real-Time Communication**: `ws` 8.21.3 (WebSocket Server)
* **AI / LLM Integration**: `@google/genai` 2.16.0 (Google Gen AI SDK for Gemini models)
* **Database**: Firebase Cloud Firestore (`firebase` 12.17.1)
* **Cloud Storage**: Azure Blob Storage (`@azure/storage-blob` 12.33.0)
* **External APIs**:
  * Azure Cognitive Services (Translator & Speech Synthesis APIs)
  * Google Translate Public API (`translate.googleapis.com` & `translate.google.com/translate_tts`)
  * QuickChart QR Server (`api.qrserver.com`)

---

## 5. System Architecture

### Communication & Data Flow

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSER                                    |
|                                                                                   |
|   +-----------------------+                    +------------------------------+   |
|   |   Speaker Interface   |                    |      Listener Interface      |   |
|   | - Web Speech STT      |                    | - Live Translated Captions   |   |
|   | - Interim Preview     |                    | - Audio Queue Player (TTS)   |   |
|   +-----------+-----------+                    +--------------^---------------+   |
+---------------+-----------------------------------------------+-------------------+
                |                                               |
                | WebSocket / HTTP                              | WebSocket / HTTP
                v                                               |
+---------------+-----------------------------------------------+-------------------+
                |            EXPRESS + WEBSOCKET SERVER         |
                |                   (server.ts)                 |
                |                                               |
                | - WebSocket Room Router & Session State       |
                | - Contextual Prompt Memory Builder            |
                | - Multi-Stage Fallback Controller             |
                +----+-------------------+------------------+---+
                     |                   |                  |
                     v                   v                  v
       +-------------+----+    +---------+-------+    +-----+--------------+
       | Google Gemini AI |    | Azure Services  |    | Firebase Firestore |
       | - 2.5 / 2.0 / 1.5|    | - Neural TTS    |    | - Session Metadata |
       |   Flash Models   |    | - Translator    |    | - Message History  |
       | - Session Summary|    | - Blob Storage  |    | - Security Rules   |
       +------------------+    +-----------------+    +--------------------+
```

1. **Speech Capture**: Speaker speaks -> Browser Web Speech API captures text -> Sends final chunk to `/api/translate` or over WebSocket.
2. **Translation Processing**: Server passes text + rolling context to Gemini Flash models -> Fallbacks to Google/Azure if needed -> Returns target translation.
3. **Broadcasting**: Server broadcasts target translation over WebSocket to listeners subscribed to that room and target language.
4. **Audio Synthesis & Playback**: Listener client fetches or receives base64 TTS audio (Azure Neural / Google fallback) -> Enqueues into `activeAudioElRef` -> Plays sequentially without overlap.

---

## 6. Project Structure

```
Bharat-Bridge/
├── .env.example                 # Environment variable template
├── ARCHITECTURE_FREEZE.md       # Architecture freeze & core specification
├── firebase-applet-config.json  # Firebase client configuration
├── firebase.json                # Firebase service configuration
├── firestore.rules              # Firestore security rules and validation logic
├── index.html                   # HTML entrypoint with font imports
├── metadata.json                # Platform metadata & permissions declaration
├── package.json                 # Project dependencies and npm scripts
├── README.md                    # Project quickstart documentation
├── security_spec.md             # Security specification & invariants
├── server.ts                    # Main Express & WebSocket backend server
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite bundler & HMR configuration
├── src/
│   ├── App.tsx                  # Main React application component & UI views
│   ├── index.css                # Global CSS styles & Tailwind directives
│   ├── languages.ts             # Supported language registry & configurations
│   ├── main.tsx                 # React DOM root mounting entrypoint
│   ├── types.ts                 # TypeScript type interfaces & data models
│   ├── lib/
│   │   ├── audio-engine.ts      # Audio stream player & SpeechSynthesis engine
│   │   ├── audio-export.ts      # PCM to WAV audio encoder & downloader
│   │   ├── azure-storage.ts     # Azure Blob Storage upload helper
│   │   ├── firebase.ts          # Firebase app initialization & auth helpers
│   │   └── qrcode.ts            # QR Code SVG generator helper
│   └── services/
│       └── api.ts               # Typed API client for translate, TTS & health
```

---

## 7. User Flows

### Flow 1: Speaker Session Creation & Live Broadcast
1. User opens the application at `http://localhost:3000`.
2. Selects source speaking language (e.g. English) and initial target language (e.g. Hindi).
3. Clicks **"Start Live Session"**.
4. System creates session entry in Firestore and opens WebSocket room.
5. Speaker receives unique Session ID / PIN and QR code overlay to share with listeners.
6. Speaker toggles microphone; Web Speech API records continuous speech.
7. Word-by-word streaming preview appears in Speaker's text area.
8. Upon sentence completion, final text is translated and broadcasted to room listeners.

### Flow 2: Listener Session Joining & Audio Listening
1. Listener opens application or scans QR code.
2. Selects **"Join Session"** and enters Session PIN.
3. Listener selects their preferred target language (e.g. Tamil).
4. Listener joins WebSocket room and receives immediate session message history.
5. Live translated captions stream onto the listener's display in real time.
6. Target audio is synthesized via Azure Neural TTS / fallbacks and played sequentially without voice overlap.

### Flow 3: Transcript Export & Session Summary
1. At session conclusion, Speaker clicks **"End Session"**.
2. Speaker or Admin clicks **"AI Summary"** to request a structured Gemini summary.
3. User downloads session transcript in `.txt`, UTF-8 BOM `.csv`, raw `.wav` audio, or triggers cloud backup to Azure Blob Storage.

---

## 8. APIs & Integrations

### 1. Google Gemini API (`@google/genai`)
* **Purpose**: Primary LLM for context-aware natural language translation and session summarization.
* **Used In**: `server.ts` (`generateTranslationWithGemini`, `/api/session-summary`).
* **Role**: Accepts prompt with 4–6 sentence conversation memory; returns contextually accurate translation or structured markdown summary.
* **Authentication**: `GEMINI_API_KEY` environment variable.
* **Known Limitations**: Rate limits apply depending on API key quota; handled by fallback chain.

### 2. Azure Cognitive Services Translator API
* **Purpose**: Secondary enterprise translation provider.
* **Used In**: `server.ts` (`/api/azure/translate`), `src/services/api.ts`.
* **Role**: Accepts source/target language codes and text array; returns translated string.
* **Authentication**: `AZURE_TRANSLATOR_KEY`, `AZURE_TRANSLATOR_REGION`.

### 3. Azure Cognitive Services Speech API (Neural TTS)
* **Purpose**: High-fidelity text-to-speech synthesis for 22 Indian languages.
* **Used In**: `server.ts` (`/api/azure/tts`), `src/services/api.ts`.
* **Role**: Accepts SSML string specifying voice name (e.g., `hi-IN-SwaraNeural`); returns base64 MP3.
* **Authentication**: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`.

### 4. Azure Blob Storage (`@azure/storage-blob`)
* **Purpose**: Persistent cloud archiving of session captions.
* **Used In**: `server.ts` (`/api/azure/upload-caption`), `src/lib/azure-storage.ts`.
* **Role**: Uploads dual-format JSON and UTF-8 BOM CSV files to container `AZURE_STORAGE_CONTAINER_NAME`.
* **Authentication**: `AZURE_STORAGE_CONNECTION_STRING`.

### 5. Universal Google Translate & TTS Fallbacks
* **Purpose**: Zero-quota high-availability fallback when primary API keys are absent or rate-limited.
* **Used In**: `server.ts` (lines 296-308, lines 197-207).

---

## 9. Database & Data

* **Database Technology**: Firebase Cloud Firestore
* **Collections & Data Models**:
  * `/sessions/{sessionId}`
    * `createdAt`: Firestore server timestamp
    * `speakerId`: UID of speaker user
    * `speakerGender`: `'male'` | `'female'`
    * `sourceLang`: BCP-47 / ISO language code
    * `targetLang`: BCP-47 / ISO language code
    * `status`: `'active'` | `'finished'`
    * `name`: Session title / string
  * `/sessions/{sessionId}/messages/{messageId}`
    * `originalText`: Speaker's raw transcribed text
    * `translatedText`: Target translation text
    * `timestamp`: Firestore server timestamp
    * `senderId`: Speaker UID
    * `sourceLang`: Language code of origin
    * `targetLang`: Target language code
* **Transient In-Memory State**:
  * `sessions` Map in `server.ts` tracks active WebSocket connections, listener sets per language group, and the last 100 messages per room for rapid history catch-up.

---

## 10. Security Requirements

* **Secret Management**: All API keys (`GEMINI_API_KEY`, `AZURE_SPEECH_KEY`, `AZURE_TRANSLATOR_KEY`, `AZURE_STORAGE_CONNECTION_STRING`) MUST remain strictly in server-side `.env` environment variables and NEVER be exposed to client bundles.
* **Authentication**: Firebase Authentication supporting Google OAuth, custom credentials, and guest mode.
* **Firestore Security Rules**:
  * Global deny by default.
  * Session creation restricted to authenticated users matching `request.auth.uid`.
  * Session message addition restricted to active session owner (`speakerId`).
  * Admin role hardcoded to authorized email (`shrushti.cyda@gmail.com`).
  * Field types, string length bounds, and server timestamp equality enforced.
* **Data Input Sanitization**: Basic HTML/XML escaping in SSML templates and CSV string double-quote escaping.

---

## 11. Performance Requirements

* **WebSocket Catch-up Latency**: Room join message history (`type: "history"`) delivered in `<50ms`.
* **Translation Response Time**: Contextual translation delivered within `200ms - 800ms`.
* **Audio Playback**: Zero voice overlap guaranteed by single-instance queue controller.
* **Concurrent Capacity**: Supported by Node.js WebSocket server architecture (tested for multi-listener room broadcasting).
* **DNS Resolution**: `dns.setDefaultResultOrder("ipv4first")` configured to prevent Windows Node fetch timeouts.

---

## 12. Testing Requirements

* **Static Type Checking**: Execute `npm run lint` (`npx tsc --noEmit`) to verify zero TypeScript errors.
* **Build Verification**: Execute `npm run build` to confirm Vite frontend compilation and esbuild backend bundling.
* **Manual Verification Checklist**:
  1. Verify server starts cleanly on port 3000 (`npm run dev`).
  2. Test Web Speech recognition preview in speaker mode.
  3. Verify WebSocket message translation broadcast to listener client.
  4. Verify sequential TTS audio playback without voice overlap.
  5. Test transcript export (.txt, .csv, .wav).

---

## 13. Development Rules

* Inspect existing codebase before adding or modifying code.
* Reuse existing components, services, and utility functions (`/lib/*`, `/services/*`).
* Maintain backward compatibility and baseline features.
* Never commit API keys, connection strings, or credentials to version control.
* Keep Speaker and Listener role responsibilities strictly isolated.
* Do not remove working features or refactor architecture without explicit approval.
* Always verify changes with `npx tsc --noEmit` and build checks before reporting complete.

---

## 14. Non-Negotiable Requirements

* **Speaker View Isolation**: Speakers MUST NOT receive target translation captions or target TTS audio.
* **Zero Voice Overlap**: TTS audio MUST play sequentially through a controlled queue.
* **Single Target Language Enforcement**: Listeners receive output matching their selected target language only.
* **No Unapproved Application Code Changes**: Documentation and audit tasks must never modify application source files.
* **Production SLA Targets**: `NEEDS CONFIRMATION`
* **Official Compliance / Security Certifications**: `NEEDS CONFIRMATION`

---

## 15. Development vs Production

| Environment | Command | Port | Middleware / Assets |
| :--- | :--- | :--- | :--- |
| **Development** | `npm run dev` (`npx tsx server.ts`) | `3000` | Express uses Vite development middleware (`app.use(vite.middlewares)`). |
| **Production Build** | `npm run build` | N/A | Bundles React via Vite into `dist/` and compiles `server.ts` into `dist/server.cjs` via esbuild. |
| **Production Start** | `npm run start` (`node dist/server.cjs`) | `3000` (or `process.env.PORT`) | Express serves static compiled assets directly from `dist/`. |

---

## 16. Known Issues & Limitations

* **Browser Web Speech API Dependency**: Continuous Speech Recognition relies on browser engine support (Chrome/Edge recommended). Firefox has limited native Web Speech STT support.
* **HTTPS Requirement for Mobile Microphones**: Mobile browser OS security policies block microphone access on unencrypted HTTP links (requires HTTPS or localhost).
* **Gemini Live Direct PCM Endpoint**: Full bi-directional raw audio PCM streaming with Gemini Live (`ai.live.connect`) is partially stubbed on server; production pipeline currently utilizes STT -> Text Translate -> TTS API.

---

## 17. Future Scope

* Direct WebSocket raw PCM streaming integration with Gemini 2.0 Flash Live API.
* Native iOS and Android application packages using React Native or Flutter.
* Support for multi-speaker panel sessions within a single broadcast room.

---

## 18. Change Management Rules

* Understand existing implementation before changing it.
* Explain significant architectural changes before implementing them.
* Avoid breaking existing functionality.
* Prefer incremental changes.
* Test affected functionality after changes.
* Update `PROJECT.md` when an important architectural or product decision changes.

---

## 19. AI Agent Instructions

An AI coding agent working on this project MUST follow these instructions:

1. Read `PROJECT.md` before significant development tasks.
2. Inspect the existing implementation before proposing changes.
3. Follow documented requirements.
4. Never assume planned functionality is already implemented.
5. Never expose secrets.
6. Avoid unnecessary rewrites.
7. Preserve working functionality.
8. Flag conflicts between a new request and documented requirements.
9. Ask for approval before major architectural changes.
10. Test changes before reporting them as complete.
11. Clearly report what files were changed.
12. Clearly report what was tested.
13. Never fabricate test results.

---

## 20. Source of Truth

`PROJECT.md` describes the current documented understanding of the project. When the codebase and documentation disagree, inspect the code and flag the discrepancy rather than silently assuming which one is correct.
