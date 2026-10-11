import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  appUrl: string;
  disableHmr: boolean;

  // Provider Routing Configuration
  translationPrimary: 'gemini' | 'azure' | 'bhashini';
  translationFallback: 'azure' | 'google' | 'bhashini' | 'none';
  ttsPrimary: 'smallest' | 'azure' | 'google';
  ttsFallback: 'azure' | 'google' | 'none';
  sttProvider: 'webspeech' | 'streaming';

  // Configurable LLM Models
  geminiModelTranslation: string;
  geminiModelSummary: string;

  // API Keys & Credentials
  geminiApiKey: string;

  azureSpeechKey: string;
  azureSpeechRegion: string;

  azureTranslatorKey: string;
  azureTranslatorRegion: string;

  bhashiniApiKey: string;
  bhashiniEndpoint: string;
  bhashiniPipelineId: string;

  smallestApiKey: string;
  smallestVoiceId: string;

  azureStorageConnectionString: string;
  azureStorageContainerName: string;

  firebaseProjectId: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  disableHmr: process.env.DISABLE_HMR === 'true',

  // Default provider routing (configurable via env)
  translationPrimary: (process.env.TRANSLATION_PRIMARY as any) || 'gemini',
  translationFallback: (process.env.TRANSLATION_FALLBACK as any) || 'azure',
  ttsPrimary: (process.env.TTS_PRIMARY as any) || 'smallest',
  ttsFallback: (process.env.TTS_FALLBACK as any) || 'azure',
  sttProvider: (process.env.STT_PROVIDER as any) || 'webspeech',

  // Configurable LLM Models
  geminiModelTranslation: process.env.GEMINI_MODEL_TRANSLATION || 'gemini-3.8-flash',
  geminiModelSummary: process.env.GEMINI_MODEL_SUMMARY || 'gemini-3.8-flash',

  // API Keys
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  azureSpeechKey: process.env.AZURE_SPEECH_KEY || '',
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION || 'centralindia',

  azureTranslatorKey: process.env.AZURE_TRANSLATOR_KEY || '',
  azureTranslatorRegion: process.env.AZURE_TRANSLATOR_REGION || 'centralindia',

  bhashiniApiKey: process.env.BHASHINI_API_KEY || '',
  bhashiniEndpoint: process.env.BHASHINI_ENDPOINT || 'https://dhruva-api.bhashini.gov.in/services/inference/v2/pipeline',
  bhashiniPipelineId: process.env.BHASHINI_PIPELINE_ID || '',

  smallestApiKey: process.env.SMALLEST_API_KEY || '',
  smallestVoiceId: process.env.SMALLEST_VOICE_ID || 'emily',

  azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
  azureStorageContainerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'bharat-bridge-captions',

  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
};
