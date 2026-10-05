/**
 * BharatBridge WebSocket Envelope & Protocol Specification
 */

export type WebSocketMessageType =
  | 'join'
  | 'audio'
  | 'text_translation'
  | 'transcription'
  | 'speech_event'
  | 'stats'
  | 'history'
  | 'interrupted'
  | 'speaker_request'
  | 'speaker_approval'
  | 'role_changed'
  | 'switch_to_listener'
  | 'room_state'
  | 'error';

export interface WebSocketEnvelope<T = any> {
  type: WebSocketMessageType;
  sessionId: string;
  requestId?: string;
  timestamp: number;
  payload?: T;
}

export interface JoinPayload {
  sessionId: string;
  role: 'speaker' | 'listener';
  gender?: 'male' | 'female';
  targetLang?: string;
}

export interface AudioPayload {
  audio: string; // Base64 audio PCM frame
  sampleRate?: number;
}

export interface TextTranslationPayload {
  originalText: string;
  translatedText?: string;
  sourceLang: string;
  targetLang: string;
  isFinal?: boolean;
}

export interface TranscriptionPayload {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  isFinal: boolean;
  speakerId?: string;
  speakerName?: string;
  requestId?: string;
  metrics?: {
    sttMs?: number;
    translationMs?: number;
    ttsMs?: number;
    totalMs?: number;
  };
}

export interface StatsPayload {
  listeners: number;
}

export interface HistoryPayload {
  messages: Array<{
    originalText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    timestamp: number;
    speakerId?: string;
    speakerName?: string;
  }>;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: any;
}

export interface SpeakerRequestPayload {
  sessionId: string;
  userId: string;
  userName: string;
  targetLang?: string;
}

export interface SpeakerApprovalPayload {
  sessionId: string;
  targetUserId: string;
  approved: boolean;
}

export interface RoleChangedPayload {
  role: 'ORGANIZER' | 'PANELIST' | 'LISTENER';
  speakerId?: string;
  speakerName?: string;
  status?: 'approved' | 'rejected' | 'limit_reached' | 'switched';
  message?: string;
}

export interface RoomStatePayload {
  activePanelistCount: number;
  maxPanelists: number;
  pendingRequests: Array<{
    userId: string;
    userName: string;
    requestedAt: number;
    targetLang?: string;
  }>;
  panelists: Array<{
    speakerId: string;
    userId: string;
    userName: string;
    active: boolean;
    sourceLang?: string;
  }>;
}

export interface SpeechEventPayload {
  type: 'speech_event';
  eventId: string;
  sessionId: string;
  speakerId: string;
  speakerName?: string;
  sourceLanguage: string;
  sourceText: string;
  sequenceNumber: number;
  timestamp: number;
}

