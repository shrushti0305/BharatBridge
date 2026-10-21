# BharatBridge v4.2 — Database & Storage Schema Specification

## 1. Overview
BharatBridge utilizes a hybrid data model:
- **Cloud Firestore**: Real-time document storage for live sessions, multi-panelist metadata, speaker state, and live transcript logs.
- **Azure Blob Storage**: Dual-format persistent cloud archiving for post-event captions (`.json` for full API payloads and `.csv` for spreadsheet/analytics workflows).

---

## 2. Firestore Collections & Schema Definitions

### Collection: `sessions/{sessionId}`
Stores top-level live event metadata, speaker configurations, and overall session status.

```typescript
interface SessionDocument {
  id: string;                    // Unique Session ID (e.g., "session-2026-0924-001")
  name: string;                  // Human-readable session title (e.g., "National Multilingual Summit")
  createdAt: Timestamp;          // Event creation ISO timestamp
  status: 'active' | 'finished'; // Current session state
  primarySourceLang: string;     // Default floor speaker language (e.g., "hi", "en")
  speakerGender: 'male' | 'female'; // Gender preference for default synthesized voice
  panelists: Array<{
    speakerId: string;          // Speaker ID ("speaker-01" through "speaker-10")
    name: string;               // Panelist display name
    language: string;           // Panelist speaking language
    active: boolean;            // Is mic currently live?
  }>;
  stats: {
    totalListeners: number;     // Active concurrent WebSocket listener count
    activeLanguages: string[]; // List of currently subscribed target language codes
  };
}
```

### Sub-Collection: `sessions/{sessionId}/messages/{messageId}`
Stores real-time speaker-attributed transcripts and translations.

```typescript
interface MessageDocument {
  id: string;                    // Unique Message ID
  speakerId: string;             // Speaker attribution ("speaker-01" through "speaker-10")
  speakerName?: string;          // Display name of panelist
  originalText: string;          // Raw transcript emitted by STT engine
  translatedText: string;        // Translated text for the session's primary target
  sourceLang: string;            // Source ISO language code (e.g., "hi")
  targetLang: string;            // Target ISO language code (e.g., "ta")
  timestamp: Timestamp;          // Timestamp of transcription completion
  sequenceNumber: number;        // Monotonically increasing sequence number per session
  isFinal: boolean;              // Finalized sentence vs interim streaming draft
}
```

---

## 3. Azure Blob Storage Hierarchy & Dual-Format Schema

Persistent caption archives are saved directly to Azure Storage container `ai-audio`.

### File Naming Convention
- **JSON Blob**: `captions-{sessionId}-{timestamp}.json`
- **CSV Blob**: `captions-{sessionId}-{timestamp}.csv`

### JSON Archive Structure
```json
{
  "sessionId": "session-2026-0924-001",
  "sessionName": "National Multilingual Summit",
  "createdAt": "2026-09-24T18:30:00.000Z",
  "captions": [
    {
      "speakerId": "speaker-01",
      "timestamp": "18:30:05",
      "originalLanguage": "hi",
      "originalCaption": "नमस्ते, भारतब्रिज सम्मेलन में आपका स्वागत है।",
      "translatedLanguage": "ta",
      "translatedCaption": "வணக்கம், பாரத்பிரிட்ஜ் மாநாட்டுக்கு நல்வரவு."
    }
  ]
}
```

### CSV Archive Structure (UTF-8 with BOM)
```csv
Timestamp,Speaker ID,Original Language,Original Text,Target Language,Translated Text
"18:30:05","speaker-01","hi","नमस्ते, भारतब्रिज सम्मेलन में आपका स्वागत है।","ta","வணக்கம், பாரத்பிரிட்ஜ் மாநாட்டுக்கு நல்வரவு."
```

---

## 4. Firestore Security Rules Summary
- `match /sessions/{sessionId}`: Read accessible to authenticated and guest listeners. Create/Update restricted to session hosts & panelists.
- `match /sessions/{sessionId}/messages/{messageId}`: Read allowed for session room members; Write restricted to active speakers (`speakerId` validated).
