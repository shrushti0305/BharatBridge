# 📚 BHARATBRIDGE — ARCHITECTURAL LEARNING GUIDE

---

## 1. Core Q&A & Conceptual Foundations

### Q1: What is a `speech_event`?
A `speech_event` is a real-time WebSocket protocol message sent by an active speaker's device when a spoken sentence is finalized by Speech-to-Text (STT). It contains the raw original transcript text, canonical event ID (`eventId`), session PIN (`sessionId`), speaker ID (`speakerId`), source language code (`sourceLanguage`), sequence counter (`sequenceNumber`), and epoch timestamp.

### Q2: Why should raw speech be sent to the server instead of being pre-translated on the client?
Sending raw speech text to the server makes the server the single authoritative translation orchestrator. When the speaker's browser pre-translates into one language, it creates asymmetric latency (secondary listener languages lag 2.5s behind). Sending raw text allows the server to translate into ALL active listener languages concurrently in parallel.

### Q3: What is language fan-out?
Language fan-out is the server process of taking ONE incoming speech event in a source language (e.g. English) and generating target-language translations for each active listener language group present in the room (e.g. 1 Hindi, 1 Marathi, 1 Tamil, 1 Telugu), then broadcasting each translation to its respective language group.

### Q4: Why does translation scale by active language rather than listener count?
If 100 listeners join in Hindi, 50 in Marathi, and 20 in Tamil, there are only **3 active languages**. The server translates the sentence **3 times** (once per language), NOT 170 times. All 100 Hindi listeners receive the same single Hindi translation result.

### Q5: What is single-flight?
Single-flight is a deduplication mechanism that ensures if duplicate requests arrive for the exact same processing key (`sessionId:eventId:targetLanguage`) while an operation is in progress, the underlying API call (Gemini or Azure) is executed **only once**. All callers share the result of that single in-flight operation.

### Q6: Why should one failed language not stop the others?
In a multi-language conference, cloud provider rate limits or network issues might cause a translation for one language (e.g. Hindi) to fail. Isolating target language execution ensures that Marathi, Tamil, and Telugu listeners continue receiving real-time translations uninterrupted.

### Q7: Why are `eventId` and `sequenceNumber` important?
- `eventId`: Uniquely correlates a spoken sentence across STT, translation, WebSockets, TTS, and telemetry logs.
- `sequenceNumber`: Guarantees monotonic ordering (1, 2, 3...) so network jitter or out-of-order WebSocket packet arrival does not scramble speech history.

---

## 2. Personal Learning Reflection

### WHAT DID I LEARN?
- How client-side pre-translation causes asymmetric latency in multi-language real-time systems.
- How to design server-authoritative single-flight fan-out orchestration.
- How to construct clean fail-safe fallback matrix pipelines.

### WHY IS SERVER-AUTHORITATIVE TRANSLATION USED?
Server-authoritative translation guarantees zero-latency-skew multi-language delivery, central deduplication, and eliminates client device processing overload.

### WHAT CAN I EXPLAIN WITHOUT AI?
I can clearly explain the entire real-time speech pipeline: STT finalization $\rightarrow$ `speech_event` WS frame $\rightarrow$ Active language group discovery $\rightarrow$ Single-flight Gemini translation fan-out $\rightarrow$ Language-group WS broadcast $\rightarrow$ Listener rendering & TTS synthesis.
