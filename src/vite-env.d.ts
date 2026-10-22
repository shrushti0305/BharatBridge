/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_TOKEN?: string;
  readonly VITE_ADMIN_EMAILS?: string;
  readonly VITE_GEMINI_DAILY_LIMIT?: string;
  readonly VITE_TTS_DAILY_CHAR_LIMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
