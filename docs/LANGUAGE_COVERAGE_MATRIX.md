# BharatBridge 22+ Language Coverage Matrix

Comprehensive specification of Speech-to-Text (STT), Neural Machine Translation (MT), Azure Neural Text-to-Speech (TTS), and listener delivery modes across all 22 Eighth Schedule Indian Languages + English for the 3-Day Supervised Live Event.

---

## 1. Primary Live Event Languages (Tier 1 Focus)

| Language | Code | STT Locale | Translation Engine | Azure Neural TTS Voice (F/M) | Delivery Mode | Tested Native Sample | Sign-off Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hindi** | `hi` | `hi-IN` | Gemini 3.8 Flash / Azure Translator | `hi-IN-SwaraNeural` / `hi-IN-MadhurNeural` | Audio + Captions | "भारतब्रिज में आपका स्वागत है।" | Mandatory Native Review |
| **Gujarati** | `gu` | `gu-IN` | Gemini 3.8 Flash / Azure Translator | `gu-IN-DhwaniNeural` / `gu-IN-NiranjanNeural` | Audio + Captions | "ભારતબ્રિજમાં આપનું સ્વાગત છે." | Mandatory Native Review |
| **Marathi** | `mr` | `mr-IN` | Gemini 3.8 Flash / Azure Translator | `mr-IN-AarohiNeural` / `mr-IN-ManoharNeural` | Audio + Captions | "भारतब्रिजमध्ये आपले स्वागत आहे." | Mandatory Native Review |
| **English** | `en` | `en-IN` / `en-US` | Gemini 3.8 Flash / Azure Translator | `en-IN-NeerjaNeural` / `en-IN-PrabhatNeural` | Audio + Captions | "Welcome to BharatBridge." | Verified |

---

## 2. Full Coverage Matrix (22 Scheduled Languages + English)

| # | Language | Code | Script | STT Locale | Translation | Azure Neural Voice (F/M) | Mode | Tested Sample Phrase |
| :---: | :--- | :---: | :--- | :---: | :---: | :--- | :---: | :--- |
| 1 | **Hindi** | `hi` | Devanagari | `hi-IN` | Yes | `hi-IN-SwaraNeural` / `hi-IN-MadhurNeural` | Audio + Captions | "भारतब्रिज में आपका स्वागत है।" |
| 2 | **Gujarati** | `gu` | Gujarati | `gu-IN` | Yes | `gu-IN-DhwaniNeural` / `gu-IN-NiranjanNeural` | Audio + Captions | "ભારતબ્રિજમાં આપનું સ્વાગત છે." |
| 3 | **Marathi** | `mr` | Devanagari | `mr-IN` | Yes | `mr-IN-AarohiNeural` / `mr-IN-ManoharNeural` | Audio + Captions | "भारतब्रिजमध्ये आपले स्वागत आहे." |
| 4 | **English** | `en` | Latin | `en-IN` / `en-US` | Yes | `en-IN-NeerjaNeural` / `en-IN-PrabhatNeural` | Audio + Captions | "Welcome to BharatBridge." |
| 5 | **Bengali** | `bn` | Bengali | `bn-IN` | Yes | `bn-IN-TanishaaNeural` / `bn-IN-BashkarNeural` | Audio + Captions | "ভারতব্রিজে আপনাকে স্বাগতম।" |
| 6 | **Tamil** | `ta` | Tamil | `ta-IN` | Yes | `ta-IN-PallaviNeural` / `ta-IN-ValluvarNeural` | Audio + Captions | "பாரத்பிரிட்ஜிற்கு நல்வரவு." |
| 7 | **Telugu** | `te` | Telugu | `te-IN` | Yes | `te-IN-ShrutiNeural` / `te-IN-MohanNeural` | Audio + Captions | "భారత్‌బ్రిడ్జ్‌కు స్వాగతం." |
| 8 | **Kannada** | `kn` | Kannada | `kn-IN` | Yes | `kn-IN-SapnaNeural` / `kn-IN-GaganNeural` | Audio + Captions | "ಭಾರತ್‌ಬ್ರಿಡ್ಜ್‌ಗೆ ಸುಸ್ವಾಗತ." |
| 9 | **Malayalam** | `ml` | Malayalam | `ml-IN` | Yes | `ml-IN-SobhanaNeural` / `ml-IN-MidhunNeural` | Audio + Captions | "ഭാരത്ബ്രിഡ്ജിലേക്ക് സ്വാഗതം." |
| 10 | **Punjabi** | `pa` | Gurmukhi | `pa-IN` | Yes | `pa-IN-RaaviNeural` / `pa-IN-OjasNeural` | Audio + Captions | "ਭਾਰਤਬ੍ਰਿਜ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ।" |
| 11 | **Urdu** | `ur` | Arabic (Urdu) | `ur-IN` | Yes | `ur-IN-GulNeural` / `ur-IN-SalmanNeural` | Audio + Captions | "بھارت برج میں خوش آمدید۔" |
| 12 | **Odia** | `or` | Odia | `or-IN` | Yes | `or-IN-SubhasiniNeural` / `or-IN-SubhasiniNeural` | Audio + Captions | "ଭାରତବ୍ରିଜକୁ ସ୍ୱାଗତ।" |
| 13 | **Assamese** | `as` | Bengali-Assamese | `as-IN` | Yes | `as-IN-YashicaNeural` / `as-IN-YashicaNeural` | Audio + Captions | "ভাৰতব্ৰিজলৈ আপোনাক স্বাগতম।" |
| 14 | **Nepali** | `ne` | Devanagari | `ne-NP` | Yes | `ne-NP-HemkalaNeural` / `ne-NP-SagarNeural` | Audio + Captions | "भारतब्रिजमा यहाँलाई स्वागत छ।" |
| 15 | **Maithili** | `mai` | Devanagari | — | Yes | — | **Captions Only** | "भारतब्रिजमे अहाँक स्वागत अछि।" |
| 16 | **Sanskrit** | `sa` | Devanagari | — | Yes | — | **Captions Only** | "भारतसेतौ भवतां स्वागतम् अस्ति।" |
| 17 | **Konkani** | `kok` | Devanagari | — | Yes | — | **Captions Only** | "भारतब्रीजाचेर तुमकां येवकार।" |
| 18 | **Sindhi** | `sd` | Arabic (Sindhi) | — | Yes | — | **Captions Only** | "ڀارت برج ۾ ڀلي ڪري آيا۔" |
| 19 | **Dogri** | `doi` | Devanagari | — | Yes | — | **Captions Only** | "भारतब्रिज च तुंदा स्वागत ऐ।" |
| 20 | **Kashmiri** | `ks` | Perso-Arabic | — | Yes | — | **Captions Only** | "بھارت برجس منٛز چھہ تُہند خیر مقدم।" |
| 21 | **Manipuri** | `mni` | Meetei Mayek | — | Yes | — | **Captions Only** | "ভারতব্রিজদা তরাম্না ওকচরি।" |
| 22 | **Bodo** | `brx` | Devanagari | — | Yes | — | **Captions Only** | "भारतब्रिजाव नोंथांखौ बरायो।" |
| 23 | **Santali** | `sat` | Ol Chiki | — | Yes | — | **Captions Only** | "ᱥᱟᱹᱜᱩᱱ ᱫᱟᱨᱟᱢ ᱵᱷᱟᱨᱚᱛᱵᱽᱨᱤᱡᱽ ᱛᱮ᱾" |

---

## 3. Operational Rules for Audio vs Captions

1. **Captions-Only Mode Enforcement**:
   - For languages with no Azure Neural TTS voice (`mai`, `sa`, `kok`, `sd`, `doi`, `ks`, `mni`, `brx`, `sat`), the client UI automatically switches to Captions-Only mode upon language selection.
   - A visible status banner is rendered: `"Live captions active. Audio synthesis is not supported for this language."`
   - No TTS synthesis requests are generated for these channels, preserving compute quota and network egress.

2. **Degradation Policy**:
   - Captions and audio are decoupled channels.
   - Any failure or latency spike in TTS synthesis or CDN audio fetching must **never** delay, pause, or block caption delivery over WebSockets.

3. **Native Speaker Review Protocol**:
   - 24 hours prior to live event commencement (Day -1), designated native speakers for **Hindi**, **Gujarati**, and **Marathi** will execute live conversational sample reviews across legal, technical, and casual registers to calibrate domain glossary prompts.
