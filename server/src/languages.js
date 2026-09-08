// Central registry of languages and speaker modes supported by the app.
export const SPEAKER_LANGUAGES = [
  { code: "auto", label: "✨ Auto Detect (Hindi / Marathi / English)", native: "Auto Detect", bcp47: ["hi-IN", "mr-IN", "en-IN"] },
  { code: "hi", label: "Hindi", native: "हिन्दी", bcp47: "hi-IN", azureVoice: "hi-IN-SwaraNeural" },
  { code: "mr", label: "Marathi", native: "मराठी", bcp47: "mr-IN", azureVoice: "mr-IN-AarohiNeural" },
  { code: "en", label: "English", native: "English", bcp47: "en-IN", azureVoice: "en-IN-NeerjaNeural" },
  { code: "hinglish", label: "Hinglish (English + Hindi)", native: "Hinglish", bcp47: ["en-IN", "hi-IN"] },
  { code: "bn", label: "Bengali", native: "বাংলা", bcp47: "bn-IN", azureVoice: "bn-IN-TanishaaNeural" },
  { code: "ta", label: "Tamil", native: "தமிழ்", bcp47: "ta-IN", azureVoice: "ta-IN-PallaviNeural" },
  { code: "te", label: "Telugu", native: "తెలుగు", bcp47: "te-IN", azureVoice: "te-IN-ShrutiNeural" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", bcp47: "kn-IN", azureVoice: "kn-IN-SapnaNeural" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", bcp47: "gu-IN", azureVoice: "gu-IN-DhwaniNeural" },
  { code: "ml", label: "Malayalam", native: "മലയാളം", bcp47: "ml-IN", azureVoice: "ml-IN-SobhanaNeural" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", bcp47: "pa-IN", azureVoice: "pa-IN-VaaniNeural" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ", bcp47: "or-IN", azureVoice: "or-IN-SubhasiniNeural" },
];

export const LANGUAGES = [
  {
    code: "en",
    label: "English",
    native: "English",
    bcp47: "en-IN",
    azureVoice: "en-IN-NeerjaNeural",
    voices: { female: "en-IN-NeerjaNeural", male: "en-IN-PrabhatNeural" },
  },
  {
    code: "hi",
    label: "Hindi",
    native: "हिन्दी",
    bcp47: "hi-IN",
    azureVoice: "hi-IN-SwaraNeural",
    voices: { female: "hi-IN-SwaraNeural", male: "hi-IN-MadhurNeural" },
  },
  {
    code: "mr",
    label: "Marathi",
    native: "मराठी",
    bcp47: "mr-IN",
    azureVoice: "mr-IN-AarohiNeural",
    voices: { female: "mr-IN-AarohiNeural", male: "mr-IN-ManoharNeural" },
  },
  {
    code: "bn",
    label: "Bengali",
    native: "বাংলা",
    bcp47: "bn-IN",
    azureVoice: "bn-IN-TanishaaNeural",
    voices: { female: "bn-IN-TanishaaNeural", male: "bn-IN-BashkarNeural" },
  },
  {
    code: "ta",
    label: "Tamil",
    native: "தமிழ்",
    bcp47: "ta-IN",
    azureVoice: "ta-IN-PallaviNeural",
    voices: { female: "ta-IN-PallaviNeural", male: "ta-IN-ValluvarNeural" },
  },
  {
    code: "te",
    label: "Telugu",
    native: "తెలుగు",
    bcp47: "te-IN",
    azureVoice: "te-IN-ShrutiNeural",
    voices: { female: "te-IN-ShrutiNeural", male: "te-IN-MohanNeural" },
  },
  {
    code: "kn",
    label: "Kannada",
    native: "ಕನ್ನಡ",
    bcp47: "kn-IN",
    azureVoice: "kn-IN-SapnaNeural",
    voices: { female: "kn-IN-SapnaNeural", male: "kn-IN-GaganNeural" },
  },
  {
    code: "gu",
    label: "Gujarati",
    native: "ગુજરાતી",
    bcp47: "gu-IN",
    azureVoice: "gu-IN-DhwaniNeural",
    voices: { female: "gu-IN-DhwaniNeural", male: "gu-IN-NiranjanNeural" },
  },
  {
    code: "ml",
    label: "Malayalam",
    native: "മലയാളം",
    bcp47: "ml-IN",
    azureVoice: "ml-IN-SobhanaNeural",
    voices: { female: "ml-IN-SobhanaNeural", male: "ml-IN-MidhunNeural" },
  },
  {
    code: "pa",
    label: "Punjabi",
    native: "ਪੰਜਾਬੀ",
    bcp47: "pa-IN",
    azureVoice: "pa-IN-VaaniNeural",
    voices: { female: "pa-IN-VaaniNeural", male: "pa-IN-OjasNeural" },
  },
  {
    code: "or",
    label: "Odia",
    native: "ଓଡ଼ିଆ",
    bcp47: "or-IN",
    azureVoice: "or-IN-SubhasiniNeural",
    voices: { female: "or-IN-SubhasiniNeural", male: "or-IN-SubhasiniNeural" },
  },
];

export const LANGUAGE_BY_CODE = Object.fromEntries(
  [...SPEAKER_LANGUAGES, ...LANGUAGES].map((l) => [l.code, l])
);

export function isValidLanguage(code) {
  return Boolean(LANGUAGE_BY_CODE[code]);
}