# 🌐 BharatBridge — 22 Official Scheduled Languages Capability Matrix

> **Coverage Audit**: Full capability status for all 22 8th Schedule Scheduled Languages of India + English.

---

| Language | ISO | Locale | Script | STT Provider | NMT Provider | TTS Provider | Primary Voice ID | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hindi** | `hi` | `hi-IN` | Devanagari | Web Speech / Azure | Gemini / Bhashini | Smallest.ai / Azure | `radhika` / `arman` | **FULLY_SUPPORTED** |
| **Marathi** | `mr` | `mr-IN` | Devanagari | Web Speech / Azure | Gemini / Bhashini | Smallest.ai / Azure | `diya` / `AarohiNeural` | **FULLY_SUPPORTED** |
| **Gujarati** | `gu` | `gu-IN` | Gujarati | Web Speech / Azure | Gemini / Google | Smallest.ai / Azure | `radhika` / `DhwaniNeural` | **FULLY_SUPPORTED** |
| **Tamil** | `ta` | `ta-IN` | Tamil | Web Speech / Azure | Gemini / Bhashini | Smallest.ai / Azure | `raman` / `PallaviNeural` | **FULLY_SUPPORTED** |
| **Telugu** | `te` | `te-IN` | Telugu | Web Speech / Azure | Gemini / Bhashini | Smallest.ai / Azure | `radhika` / `ShrutiNeural` | **FULLY_SUPPORTED** |
| **Bengali** | `bn` | `bn-IN` | Bengali | Web Speech / Azure | Gemini / Bhashini | Smallest.ai / Azure | `radhika` / `TanishaaNeural` | **FULLY_SUPPORTED** |
| **Kannada** | `kn` | `kn-IN` | Kannada | Web Speech / Azure | Gemini / Bhashini | Smallest.ai / Azure | `radhika` / `SapnaNeural` | **FULLY_SUPPORTED** |
| **Malayalam** | `ml` | `ml-IN` | Malayalam | Web Speech / Azure | Gemini / Bhashini | Smallest.ai / Azure | `radhika` / `SobhanaNeural` | **FULLY_SUPPORTED** |
| **Punjabi** | `pa` | `pa-IN` | Gurmukhi | Web Speech / Azure | Gemini / Bhashini | Smallest.ai / Azure | `arman` / `OjasNeural` | **FULLY_SUPPORTED** |
| **Urdu** | `ur` | `ur-IN` | Perso-Arabic | Web Speech / Azure | Gemini / Google | Azure Speech | `GulNeural` | **FULLY_SUPPORTED** |
| **Odia** | `or` | `or-IN` | Odia | Web Speech / Azure | Gemini / Bhashini | Azure Speech | `SubhasiniNeural` | **FULLY_SUPPORTED** |
| **Assamese** | `as` | `as-IN` | Bengali-Assamese | Web Speech / Azure | Gemini / Bhashini | Azure Speech | `YashicaNeural` | **FULLY_SUPPORTED** |
| **Sanskrit** | `sa` | `sa-IN` | Devanagari | Web Speech | Gemini / Google | Google Neural | `sa-IN-Standard` | **PARTIALLY_SUPPORTED** |
| **Nepali** | `ne` | `ne-NP` | Devanagari | Web Speech | Gemini / Google | Google Neural | `ne-NP-Standard` | **PARTIALLY_SUPPORTED** |
| **Sindhi** | `sd` | `sd-IN` | Devanagari/Arabic| Web Speech | Gemini / Bhashini | Google Neural | `sd-IN-Standard` | **PARTIALLY_SUPPORTED** |
| **Konkani** | `kok`| `kok-IN` | Devanagari | Web Speech | Gemini / Bhashini | Azure / Google | `hi-IN-SwaraNeural` | **PARTIALLY_SUPPORTED** |
| **Maithili** | `ma` | `mai-IN` | Devanagari | Web Speech | Gemini / Bhashini | Azure / Google | `hi-IN-SwaraNeural` | **PARTIALLY_SUPPORTED** |
| **Dogri** | `doi`| `doi-IN` | Devanagari | Web Speech | Gemini / Bhashini | Google Neural | `hi-IN-SwaraNeural` | **PARTIALLY_SUPPORTED** |
| **Kashmiri** | `ks` | `ks-IN` | Perso-Arabic | Web Speech | Gemini / Bhashini | Google Neural | `ur-IN-GulNeural` | **PARTIALLY_SUPPORTED** |
| **Manipuri (Meitei)**|`me`| `mni-IN` | Meitei Mayek | Web Speech | Gemini / Bhashini | Google Neural | `as-IN-YashicaNeural`| **PARTIALLY_SUPPORTED** |
| **Bodo** | `brx`| `brx-IN` | Devanagari | Web Speech | Gemini / Bhashini | Google Neural | `hi-IN-SwaraNeural` | **PARTIALLY_SUPPORTED** |
| **Santali** | `sat`| `sat-IN` | Ol Chiki | Web Speech | Gemini / Bhashini | Google Neural | `hi-IN-SwaraNeural` | **PARTIALLY_SUPPORTED** |
| **English** | `en` | `en-IN` | Latin | Web Speech / Azure | Gemini / Azure | Smallest.ai / Azure | `emily` / `NeerjaNeural` | **FULLY_SUPPORTED** |

---

## Status Classification
* **`FULLY_SUPPORTED`**: Tested end-to-end continuous pipeline across STT, Gemini NMT, and Smallest.ai/Azure Neural TTS.
* **`PARTIALLY_SUPPORTED`**: Supported via Gemini NMT and fallback Google/Azure regional voices.
* **`FALLBACK_REQUIRED`**: Uses nearest regional dialect voice fallback for audio synthesis.
