/**
 * BharatBridge Decoupled Provider Interfaces & Normalized Data Models
 */

// --- Normalized Request & Response Data Models ---

export interface ContextItem {
  originalText: string;
  translatedText: string;
}

export interface STTTranscript {
  text: string;
  isFinal: boolean;
  timestamp: number;
  confidence?: number;
  language: string;
  sessionId: string;
  requestId?: string;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: ContextItem[];
  sessionId: string;
  requestId: string;
}

export interface TranslationResponse {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: string;
  requestId: string;
  timestamp: number;
  executionTimeMs: number;
  warning?: string;
}

export interface TTSRequest {
  text: string;
  languageCode: string;
  voiceName?: string;
  gender?: 'male' | 'female';
  sessionId: string;
  requestId: string;
}

export interface TTSResponse {
  audio: string; // Base64 encoded audio
  format: string; // Mime type (e.g. audio/mp3)
  provider: string;
  requestId: string;
  timestamp: number;
  executionTimeMs: number;
}

export interface StorageUploadPayload {
  sessionId: string;
  sessionName: string;
  messages: Array<{
    sourceLang?: string;
    targetLang?: string;
    originalText: string;
    translatedText: string;
    timestamp?: any;
  }>;
}

export interface StorageUploadResult {
  success: boolean;
  blobUrl?: string;
  blobName?: string;
  jsonBlobUrl?: string;
  error?: string;
  provider: string;
  mock?: boolean;
}

// --- Provider Interface Contracts ---

export interface ITranslationProvider {
  name: string;
  isConfigured(): boolean;
  translate(request: TranslationRequest): Promise<TranslationResponse>;
}

export interface ITTSProvider {
  name: string;
  isConfigured(): boolean;
  synthesize(request: TTSRequest): Promise<TTSResponse>;
}

export interface ISTTProvider {
  name: string;
  isConfigured(): boolean;
  processAudioChunk(audioBuffer: Buffer | ArrayBuffer, sessionId: string, language: string): Promise<STTTranscript>;
}

export interface IStorageProvider {
  name: string;
  isConfigured(): boolean;
  uploadCaptions(payload: StorageUploadPayload): Promise<StorageUploadResult>;
}

// --- Provider Health Status ---

export interface ProviderHealthInfo {
  providerName: string;
  type: 'translation' | 'tts' | 'stt' | 'storage';
  configured: boolean;
  status: 'healthy' | 'degraded' | 'unconfigured' | 'error';
  latencyMs?: number;
  lastError?: string;
}
