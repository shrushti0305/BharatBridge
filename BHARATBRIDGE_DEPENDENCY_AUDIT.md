# 1. Runtime Requirements

- **Node.js version**: v22.23.2
- **npm version**: 10.9.8
- **OS**: Windows_NT 10.0.19045 (Windows 10 Pro)
- **Frontend runtime**: Web Browser (React 19 + Vite 6 + Web Speech API + Web Audio API / HTML5 Audio)
- **Backend runtime**: Node.js (Express 4 + ws 8 + tsx 4 execution engine)

---

# 2. Direct Dependencies

| Package | Required by | Installed version | Declared version | Status |
| :--- | :--- | :--- | :--- | :--- |
| `@azure/storage-blob` | Azure Blob Storage integration (`server.ts`, `src/lib/azure-storage.ts`) | 12.33.0 | `^12.33.0` | INSTALLED |
| `@google/genai` | Gemini AI translation & session summary engine (`server.ts`, `src/providers/translation/gemini.ts`) | 2.22.0 | `^2.16.0` | INSTALLED |
| `@tailwindcss/vite` | Tailwind CSS Vite plugin (`vite.config.ts`) | 4.3.3 | `^4.1.14` | INSTALLED |
| `@vitejs/plugin-react` | Vite React plugin (`vite.config.ts`) | 5.2.0 | `^5.0.4` | INSTALLED |
| `dotenv` | Environment variable loader (`server.ts`) | 17.4.2 | `^17.2.3` | INSTALLED |
| `express` | Express HTTP backend server (`server.ts`) | 4.22.3 | `^4.21.2` | INSTALLED |
| `firebase` | Firestore Database & Firebase Authentication (`src/lib/firebase.ts`, `src/App.tsx`) | 12.19.0 | `^12.17.1` | INSTALLED |
| `lucide-react` | UI Icon components (`src/App.tsx`) | 0.546.0 | `^0.546.0` | INSTALLED |
| `motion` | UI Framer Motion animations (`src/App.tsx`) | 12.43.0 | `^12.23.24` | INSTALLED |
| `react` | React UI Framework (`src/App.tsx`, `src/main.tsx`) | 19.3.0 | `^19.0.1` | INSTALLED |
| `react-dom` | React DOM Renderer (`src/main.tsx`) | 19.3.0 | `^19.0.1` | INSTALLED |
| `vite` | Vite dev server & bundler (`package.json`) | 6.4.3 | `^6.2.3` | INSTALLED |
| `ws` | WebSocket real-time broadcast engine (`server.ts`) | 8.21.3 | `^8.21.3` | INSTALLED |

---

# 3. Development Dependencies

| Package | Required by | Installed version | Declared version | Status |
| :--- | :--- | :--- | :--- | :--- |
| `@firebase/eslint-plugin-security-rules` | Firestore Security Rules Linting | 0.0.2 | `^0.0.2` | INSTALLED |
| `@types/express` | TypeScript Express definitions | 4.17.25 | `^4.17.21` | INSTALLED |
| `@types/node` | TypeScript Node.js definitions | 22.20.2 | `^22.14.0` | INSTALLED |
| `@types/ws` | TypeScript WS definitions | 8.18.1 | `^8.18.1` | INSTALLED |
| `autoprefixer` | PostCSS CSS prefixing | 10.6.0 | `^10.4.21` | INSTALLED |
| `esbuild` | Server CJS bundler (`package.json`) | 0.28.2 | `^0.28.2` | INSTALLED |
| `tailwindcss` | Tailwind CSS core engine | 4.3.3 | `^4.1.14` | INSTALLED |
| `tsx` | TypeScript Node execution (`npm run dev`) | 4.23.13 | `^4.21.0` | INSTALLED |
| `typescript` | TypeScript compiler (`npx tsc`) | 5.9.3 | `^5.8.2` | INSTALLED |

---

# 4. Provider Dependencies

- **Gemini**: Package present (`@google/genai` v2.22.0). Uses official SDK integration (`GoogleGenAI`) in `server.ts` & `src/providers/translation/gemini.ts`.
- **Azure Speech**: No SDK package installed (`@azure/cognitiveservices-speech-sdk` is missing from `package.json`). Integrated via HTTP REST API endpoint `POST https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`.
- **Azure Translator**: No SDK package installed (`@azure/cognitiveservices-translator` is missing from `package.json`). Integrated via HTTP REST API endpoint `POST https://api.cognitive.microsofttranslator.com/translate?api-version=3.0`.
- **Google Translation**: No SDK package installed. Integrated via high-availability HTTP endpoint `https://translate.googleapis.com/translate_a/single`.
- **Google TTS**: No SDK package installed. Integrated via HTTP endpoint `https://translate.google.com/translate_tts`.
- **Firebase**: Package present (`firebase` v12.19.0). Uses official SDK integration (`initializeApp`, `getFirestore`, `getAuth`) in `src/lib/firebase.ts`.
- **WebSocket**: Package present (`ws` v8.21.3 on backend; native browser `WebSocket` API on frontend).

---

# 5. Environment Variables

- `GEMINI_API_KEY` — PRESENT
- `AZURE_STORAGE_CONNECTION_STRING` — PRESENT
- `AZURE_STORAGE_CONTAINER_NAME` — PRESENT
- `AZURE_TRANSLATOR_KEY` — PRESENT
- `AZURE_TRANSLATOR_REGION` — PRESENT
- `AZURE_SPEECH_KEY` — PRESENT
- `AZURE_SPEECH_REGION` — PRESENT
- `AZURE_TRANSLATOR_ENDPOINT` — PRESENT
- `AZURE_DOCUMENT_TRANSLATOR_ENDPOINT` — PRESENT
- `SMALLEST_API_KEY` — PRESENT
- `SMALLEST_VOICE_ID` — PRESENT
- `TRANSLATION_PRIMARY` — PRESENT
- `TRANSLATION_FALLBACK` — PRESENT
- `TTS_PRIMARY` — PRESENT
- `TTS_FALLBACK` — PRESENT
- `STT_PROVIDER` — PRESENT
- `BHASHINI_API_KEY` — MISSING
- `BHASHINI_ENDPOINT` — MISSING (defaults to code fallback)
- `BHASHINI_PIPELINE_ID` — MISSING
- `FIREBASE_PROJECT_ID` — MISSING (configured via `firebase-applet-config.json`)
- `PORT` — MISSING (defaults to 3000)
- `NODE_ENV` — MISSING (defaults to 'development')
- `GEMINI_MODEL_TRANSLATION` — MISSING (defaults to 'gemini-2.5-flash')
- `GEMINI_MODEL_SUMMARY` — MISSING (defaults to 'gemini-2.5-flash')

---

# 6. Build Verification

- **TypeScript**: **PASS** (`npx tsc --noEmit` completed with 0 errors).
- **Frontend build**: **FAIL** (`vite build` fails due to Windows directory junction pathing: Rollup receives `D:/AI DS CYDA documents/bharatbridge/Bharat-Bridge/index.html` as chunk name).
- **Backend startup**: **PASS** (`npx tsx server.ts` and `esbuild server.ts --outfile=dist/server.cjs` completed cleanly; backend running on `http://localhost:3000`).
- **Existing tests**: **PASS** (`scratch/test_phase2_translation.js` executed 8 automated tests with 100% PASS).

---

# 7. Dependency Problems

1. **Vite Production Build Failure Under Directory Junction**: When running `npm run build`, `vite build` encounters a path resolution error because the workspace path `C:\Users\Admin\antigravity\Bharat-Bridge` is a Windows Directory Junction pointing to `D:\AI DS CYDA documents\bharatbridge\Bharat-Bridge`.
2. **Missing SDK Packages for Azure Services**: Azure Speech and Azure Translator are implemented via raw HTTP `fetch()` requests instead of official `@azure/cognitiveservices-speech-sdk` and `@azure/cognitiveservices-translator` packages.
3. **Missing SDK Package for Smallest AI**: Integrated via raw HTTP `fetch()` requests without `@smallest-ai/sdk`.
4. **Missing Bhashini Credentials**: Bhashini environment variables (`BHASHINI_API_KEY`, `BHASHINI_PIPELINE_ID`) are unpopulated in `.env`.

---

# 8. Provider Dependencies Not Yet Required

The following dependencies are **not** installed and are **not yet required** for single-server development/testing:

- **Redis Client (`ioredis` / `redis`)**: Required later in multi-node production for distributed WebSocket state, distributed locks, and pub/sub message bus across multiple server instances.
- **WebSocket Cluster Adapter (`@socket.io/redis-adapter` or custom WS cluster adapter)**: Required later for multi-instance horizontal scaling.
- **Load & Performance Testing Frameworks (`k6` / `autocannon` / `artillery`)**: Required later for high-concurrency load testing (1,000+ simultaneous multi-language listeners).
- **Production Observability & APM (`@opentelemetry/sdk-node`, `pino`, `winston`)**: Required later for production log aggregation, distributed tracing, and APM monitoring.
- **Server-Side Audio Encoder / Audio Processing (`fluent-ffmpeg` / `@breezsnd/ffmpeg`)**: Required in Phase 3 for server-side single-flight TTS chunk encoding and broadcasting.

---

# 9. Final Classification

Classification: **READY for Development & Real-Time Testing** / **NOT READY for Production Distribution Build (`npm run build`)**.

### Operational Status Matrix:
- **INSTALLED**: **YES** (All 13 direct dependencies and 9 dev dependencies are fully installed in `node_modules`).
- **CONFIGURED**: **YES** (`.env` and `firebase-applet-config.json` contain active configurations for Gemini AI, Azure Storage, Azure Speech, Azure Translator, Smallest AI, and Firebase).
- **FUNCTIONAL**: **YES** (Real-time `speech_event` processing, server-authoritative multi-language translation, single-flight deduplication, and active language discovery operate cleanly).
- **RUNTIME-TESTED**: **YES** (Verified via automated test suite `scratch/test_phase2_translation.js` with 8/8 tests passing and sub-second parallel delivery latency).

---
