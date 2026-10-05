/**
 * BharatBridge Authoritative Single Language Registry
 * Covers 22 Scheduled Indian Languages + English
 */

export interface LanguageDefinition {
  id: string;                      // Canonical ISO 639-1 / 639-3 code e.g. 'hi', 'mr', 'mai'
  name: string;                    // Standard English name e.g. 'Hindi', 'Maithili'
  nativeName: string;              // Native script name e.g. 'हिन्दी', 'मैथिली'
  locale: string;                  // BCP-47 locale code e.g. 'hi-IN'
  script: string;                  // Primary writing script
  direction: 'ltr' | 'rtl';        // Layout direction
  sttSupported: boolean;           // Web Speech API / DeepSpeech support
  translationSupported: boolean;   // Gemini / Google Translate support
  ttsSupported: boolean;           // Azure / Google TTS support
  azureVoice?: string;             // Azure Neural Voice ID
  googleVoiceCode?: string;        // Google TTS language parameter
  fallbackProvider: 'google-tts' | 'none';
  enabled: boolean;
}

export const BHARATBRIDGE_LANGUAGES: LanguageDefinition[] = [
  {
    id: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    locale: "hi-IN",
    script: "Devanagari",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "hi-IN-SwaraNeural",
    googleVoiceCode: "hi",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    locale: "bn-IN",
    script: "Bengali",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "bn-IN-TanishaaNeural",
    googleVoiceCode: "bn",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    locale: "mr-IN",
    script: "Devanagari",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "mr-IN-AarohiNeural",
    googleVoiceCode: "mr",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    locale: "te-IN",
    script: "Telugu",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "te-IN-ShrutiNeural",
    googleVoiceCode: "te",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    locale: "ta-IN",
    script: "Tamil",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "ta-IN-PallaviNeural",
    googleVoiceCode: "ta",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "gu",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    locale: "gu-IN",
    script: "Gujarati",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "gu-IN-DhwaniNeural",
    googleVoiceCode: "gu",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "ur",
    name: "Urdu",
    nativeName: "اردو",
    locale: "ur-IN",
    script: "Arabic (Urdu)",
    direction: "rtl",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "ur-IN-GulNeural",
    googleVoiceCode: "ur",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "kn",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    locale: "kn-IN",
    script: "Kannada",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "kn-IN-SapnaNeural",
    googleVoiceCode: "kn",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "or",
    name: "Odia",
    nativeName: "ଓଡ଼ିଆ",
    locale: "or-IN",
    script: "Odia",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "or-IN-SubhasiniNeural",
    googleVoiceCode: "or",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "ml",
    name: "Malayalam",
    nativeName: "മലയാളം",
    locale: "ml-IN",
    script: "Malayalam",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "ml-IN-SobhanaNeural",
    googleVoiceCode: "ml",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    locale: "pa-IN",
    script: "Gurmukhi",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "pa-IN-OjasNeural",
    googleVoiceCode: "pa",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "as",
    name: "Assamese",
    nativeName: "অসমীয়া",
    locale: "as-IN",
    script: "Bengali-Assamese",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "as-IN-YashicaNeural",
    googleVoiceCode: "as",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "en",
    name: "English",
    nativeName: "English",
    locale: "en-IN",
    script: "Latin",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "en-IN-NeerjaNeural",
    googleVoiceCode: "en",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "ne",
    name: "Nepali",
    nativeName: "नेपाली",
    locale: "ne-IN",
    script: "Devanagari",
    direction: "ltr",
    sttSupported: true,
    translationSupported: true,
    ttsSupported: true,
    azureVoice: "ne-NP-HemkalaNeural",
    googleVoiceCode: "ne",
    fallbackProvider: "google-tts",
    enabled: true,
  },
  {
    id: "mai",
    name: "Maithili",
    nativeName: "मैथिली",
    locale: "mai-IN",
    script: "Devanagari",
    direction: "ltr",
    sttSupported: false,
    translationSupported: true,
    ttsSupported: false,
    fallbackProvider: "none",
    enabled: true,
  },
  {
    id: "sa",
    name: "Sanskrit",
    nativeName: "संस्कृत",
    locale: "sa-IN",
    script: "Devanagari",
    direction: "ltr",
    sttSupported: false,
    translationSupported: true,
    ttsSupported: false,
    fallbackProvider: "none",
    enabled: true,
  },
  {
    id: "kok",
    name: "Konkani",
    nativeName: "कोंकणी",
    locale: "kok-IN",
    script: "Devanagari",
    direction: "ltr",
    sttSupported: false,
    translationSupported: true,
    ttsSupported: false,
    fallbackProvider: "none",
    enabled: true,
  },
  {
    id: "sd",
    name: "Sindhi",
    nativeName: "سنڌي",
    locale: "sd-IN",
    script: "Arabic",
    direction: "rtl",
    sttSupported: false,
    translationSupported: true,
    ttsSupported: false,
    fallbackProvider: "none",
    enabled: true,
  },
  {
    id: "doi",
    name: "Dogri",
    nativeName: "डोगरी",
    locale: "doi-IN",
    script: "Devanagari",
    direction: "ltr",
    sttSupported: false,
    translationSupported: true,
    ttsSupported: false,
    fallbackProvider: "none",
    enabled: true,
  },
  {
    id: "mni",
    nativeName: "মৈতৈলোন্",
    name: "Manipuri",
    locale: "mni-IN",
    script: "Meetei Mayek",
    direction: "ltr",
    sttSupported: false,
    translationSupported: true,
    ttsSupported: false,
    fallbackProvider: "none",
    enabled: true,
  },
  {
    id: "brx",
    name: "Bodo",
    nativeName: "बोडो",
    locale: "brx-IN",
    script: "Devanagari",
    direction: "ltr",
    sttSupported: false,
    translationSupported: true,
    ttsSupported: false,
    fallbackProvider: "none",
    enabled: true,
  },
  {
    id: "ks",
    name: "Kashmiri",
    nativeName: "کٲشُر",
    locale: "ks-IN",
    script: "Arabic (Kashmiri)",
    direction: "rtl",
    sttSupported: false,
    translationSupported: true,
    ttsSupported: false,
    fallbackProvider: "none",
    enabled: true,
  },
  {
    id: "sat",
    name: "Santali",
    nativeName: "সংথাளி",
    locale: "sat-IN",
    script: "Ol Chiki",
    direction: "ltr",
    sttSupported: false,
    translationSupported: true,
    ttsSupported: false,
    fallbackProvider: "none",
    enabled: true,
  },
];

// Legacy alias map for backward compatibility
const LEGACY_LANGUAGE_ALIASES: Record<string, string> = {
  ma: "mai",
  me: "mni",
  maithili: "mai",
  manipuri: "mni",
  meitei: "mni",
  bodo: "brx",
  santali: "sat",
  nepali: "ne"
};

/**
 * Resolves any language code, legacy alias, or language name to its canonical LanguageDefinition
 */
export function resolveLanguageDefinition(codeOrName: string): LanguageDefinition {
  if (!codeOrName || typeof codeOrName !== 'string') {
    return BHARATBRIDGE_LANGUAGES.find(l => l.id === "hi")!;
  }
  const clean = codeOrName.trim().toLowerCase();
  const canonicalCode = LEGACY_LANGUAGE_ALIASES[clean] || clean;

  const match = BHARATBRIDGE_LANGUAGES.find(l => 
    l.id.toLowerCase() === canonicalCode || 
    l.name.toLowerCase() === canonicalCode ||
    l.locale.toLowerCase() === canonicalCode
  );

  return match || BHARATBRIDGE_LANGUAGES.find(l => l.id === "hi")!;
}

/**
 * Returns canonical ISO language code (e.g. 'mai', 'mni', 'hi')
 */
export function getCanonicalLanguageCode(codeOrName: string): string {
  return resolveLanguageDefinition(codeOrName).id;
}

/**
 * Checks if a language code or name is supported in the registry
 */
export function isLanguageSupported(codeOrName: string): boolean {
  if (!codeOrName) return false;
  const clean = codeOrName.trim().toLowerCase();
  const canonicalCode = LEGACY_LANGUAGE_ALIASES[clean] || clean;
  return BHARATBRIDGE_LANGUAGES.some(l => 
    l.id.toLowerCase() === canonicalCode || 
    l.name.toLowerCase() === canonicalCode
  );
}

/**
 * Returns all language definitions
 */
export function getAllLanguages(): LanguageDefinition[] {
  return BHARATBRIDGE_LANGUAGES;
}
