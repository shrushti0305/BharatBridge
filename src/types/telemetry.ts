/**
 * BharatBridge Deterministic Telemetry & Event Model Specification
 */

export type TelemetryStage = 
  | 'STT' 
  | 'TRANSLATION' 
  | 'WEBSOCKET' 
  | 'LISTENER' 
  | 'TTS' 
  | 'AUDIO';

export type TelemetryEventType =
  | 'STT_FINAL'
  | 'TRANSLATION_REQUEST' 
  | 'TRANSLATION_SUCCESS' 
  | 'TRANSLATION_FAILURE' 
  | 'TRANSLATION_FALLBACK'
  | 'WS_SEND' 
  | 'WS_SERVER_RECEIVE' 
  | 'WS_AUTHORIZED' 
  | 'WS_REJECTED'
  | 'LANGUAGE_GROUP_MATCH' 
  | 'WS_BROADCAST'
  | 'LISTENER_RECEIVE' 
  | 'LISTENER_RENDER'
  | 'TTS_REQUEST' 
  | 'TTS_SUCCESS' 
  | 'TTS_FAILURE'
  | 'AUDIO_QUEUE_ADD' 
  | 'AUDIO_PLAY_START' 
  | 'AUDIO_PLAY_SUCCESS' 
  | 'AUDIO_PLAY_FAILURE'
  | 'WS_CONNECTED' 
  | 'WS_DISCONNECTED';

export type TelemetryStatus = 
  | 'SUCCESS' 
  | 'FAILURE' 
  | 'FALLBACK' 
  | 'REJECTED' 
  | 'NOT_MEASURED';

export type FailureCode =
  | 'STT_FAILURE'
  | 'TRANSLATION_FAILURE'
  | 'TRANSLATION_FALLBACK'
  | 'WS_DISCONNECTED'
  | 'WS_AUTH_REJECTED'
  | 'LANGUAGE_GROUP_MISMATCH'
  | 'LISTENER_NOT_REACHED'
  | 'TTS_FAILURE'
  | 'MOBILE_BROWSER_AUDIO_AUTOPLAY';

export interface TelemetryEvent {
  eventId: string;
  sessionId: string;
  speakerId?: string;
  listenerId?: string;
  sourceLanguage: string;
  targetLanguage?: string;
  stage: TelemetryStage;
  eventType: TelemetryEventType;
  status: TelemetryStatus;
  timestamp: number;
  sequenceNumber: number;
  provider?: string;
  latencyMs?: number | 'NOT_MEASURED';
  errorCode?: FailureCode | string;
  errorMessage?: string;
}

export interface MetricPercentiles {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface SystemMetricsSummary {
  activePanelists: number;
  activeListeners: number;
  activeLanguages: number;
  successCount: number;
  failureCount: number;
  reconnectCount: number;
  providerFailures: Record<string, number>;
  latencies: {
    stt: MetricPercentiles;
    translation: MetricPercentiles;
    websocket: MetricPercentiles;
    tts: MetricPercentiles;
    totalPipeline: MetricPercentiles;
  };
}
