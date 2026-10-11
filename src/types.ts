/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ORGANIZER' | 'PANELIST' | 'LISTENER';
export type SpeakerRequestStatus = 'idle' | 'pending' | 'approved' | 'rejected' | 'limit_reached';

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  script: string;
  direction: "ltr" | "rtl";
  sttSupported: boolean;
  translationSupported: boolean;
  ttsSupported: boolean;
  enabled: boolean;
}

export interface LanguageCapability {
  languageCode: string;
  speechToText: boolean;
  translation: boolean;
  textToSpeech: boolean;
  qualityLevel: "high" | "medium" | "experimental";
}

export interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: string;
}

export interface TranslationPair {
  id: string;
  sourceCode: string;
  targetCode: string;
  name?: string;
}

export interface UserProfile {
  defaultSourceCode: string;
  defaultTargetCode: string;
  savedPairs: TranslationPair[];
  gender: 'male' | 'female';
}

export interface Session {
  id: string;
  name: string;
  createdAt: any; // Firestore Timestamp
  speakerId: string;
  speakerGender: 'male' | 'female';
  sourceLang: string;
  targetLang: string;
  status: 'active' | 'finished';
}

export interface Message {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: any; // Firestore Timestamp
  senderId: string;
  sourceLang: string;
  targetLang: string;
  speakerId?: string;
  speakerName?: string;
}
