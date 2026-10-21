# 🛠️ BharatBridge — API & Provider Specification

> **Engineering Principle**: `CAPABILITY → ROUTING → FALLBACK → OBSERVABILITY`

---

## 1. Google Gemini API (`@google/genai`)

* **Role**: Primary AI Context Translation & Session Summarization Layer.
* **Environment Configuration**:
  ```env
  GEMINI_API_KEY=YOUR_GEMINI_API_KEY
  GEMINI_MODEL_TRANSLATION=gemini-2.5-flash
  GEMINI_MODEL_SUMMARY=gemini-2.5-flash
  ```
* **Responsibilities**:
  1. Context-aware NMT translation with rolling 4-sentence context (`ConversationContextManager`).
  2. Entity, proper noun, pronoun, number, and terminology preservation.
  3. Session-end structured summary generation (`/api/session-summary`).
* **Input Envelope**: `{ sourceLanguage, targetLanguage, text, context }`
* **Output Envelope**: Returns clean translated text without conversational intro/outro.
* **Failure Chain**: `Gemini` $\rightarrow$ `Google Translate GTx` $\rightarrow$ `Azure Translator API` $\rightarrow$ `Bhashini`.

---

## 2. Bhashini API (MeitY Govt of India)

* **Role**: Primary Indic Regional Language Provider.
* **Environment Configuration**:
  ```env
  BHASHINI_API_KEY=YOUR_BHASHINI_API_KEY
  BHASHINI_ENDPOINT=https://dhruva-api.bhashini.gov.in/services/inference/v2/pipeline
  BHASHINI_PIPELINE_ID=YOUR_BHASHINI_PIPELINE_ID
  ```
* **Capability Registry Checks**:
  * `BhashiniProvider.supportsSTT(language)`
  * `BhashiniProvider.supportsTranslation(source, target)`
  * `BhashiniProvider.supportsTTS(language)`
* **Security Rule**: Credentials remain 100% server-side in `.env`.

---

## 3. Smallest.ai Waves API

* **Role**: Ultra-Fast Neural Voice Synthesis Provider (~85ms synthesis latency).
* **Environment Configuration**:
  ```env
  SMALLEST_API_KEY=YOUR_SMALLEST_API_KEY
  SMALLEST_VOICE_ID=radhika
  ```
* **Language-Aware Voice Selection**:
  * 🇮🇳 **Hindi (`hi`)**: `radhika` (Female) / `arman` (Male)
  * 🇮🇳 **Marathi (`mr`)**: `diya` (Female)
  * 🇮🇳 **Tamil (`ta`)**: `raman` (Male)
  * 🇮🇳 **Gujarati (`gu`)**: `radhika` (Female)
  * 🇬🇧 **English (`en`)**: `emily` (Female)
* **Telemetry**: Measures `ttsRequestStartedAt`, `ttsFirstByteAt`, `ttsCompletedAt`.

---

## 4. Azure Speech & Azure Translator API

* **Role**: Enterprise Speech & Translation Fallback Provider.
* **Environment Configuration**:
  ```env
  AZURE_SPEECH_KEY=YOUR_AZURE_SPEECH_KEY
  AZURE_SPEECH_REGION=centralindia
  AZURE_TRANSLATOR_KEY=YOUR_AZURE_TRANSLATOR_KEY
  AZURE_TRANSLATOR_REGION=centralindia
  ```
* **Neural Voice Registry**: `hi-IN-SwaraNeural`, `mr-IN-AarohiNeural`, `gu-IN-DhwaniNeural`, `ta-IN-PallaviNeural`, `te-IN-ShrutiNeural`, `kn-IN-SapnaNeural`, `bn-IN-TanishaaNeural`.

---

## 5. Firebase Authentication & Firestore Database

* **Role**: Identity Management & Persistent Audio Session Record.
* **Security & Authorization**:
  * Frontend sends Firebase ID tokens over WSS/HTTPS.
  * Backend enforces: `user identity` + `session membership` + `role` (`ADMIN` | `SPEAKER` | `LISTENER`).
* **Non-Blocking Write Rule**: Firestore writes MUST occur asynchronously off the critical live audio path.

---

## 6. Azure Blob Storage

* **Role**: Long-term export & dual-format JSON / CSV logging (`ai-audio` container).
* **Non-Blocking Rule**: Blob uploads happen in background queues without delaying live WebSocket audio delivery.

---

## 7. Web Audio & Browser APIs

* **MediaDevices API**: Microphone stream capture via `getUserMedia()`.
* **Web Audio API**: Unmutes `AudioContext` and enforces monotonically increasing `sequenceNumber` audio queue (`ttsQueueRef`).
