import { ITTSProvider, TTSRequest, TTSResponse } from "./interface";
import { config } from "../../config/env";

const AZURE_VOICE_MAP: Record<string, string> = {
  hi: "hi-IN-SwaraNeural",
  ta: "ta-IN-PallaviNeural",
  te: "te-IN-ShrutiNeural",
  mr: "mr-IN-AarohiNeural",
  gu: "gu-IN-DhwaniNeural",
  bn: "bn-IN-TanishaaNeural",
  kn: "kn-IN-SapnaNeural",
  ml: "ml-IN-SobhanaNeural",
  en: "en-IN-NeerjaNeural",
  pa: "pa-IN-OjasNeural",
  ur: "ur-IN-GulNeural",
  or: "or-IN-SubhasiniNeural",
  as: "as-IN-YashicaNeural"
};

export class AzureTTSProvider implements ITTSProvider {
  public name = "azure-speech-tts";

  public isConfigured(): boolean {
    return Boolean(config.azureSpeechKey);
  }

  public async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const startTime = Date.now();
    const cleanText = request.text.trim();
    if (!cleanText) {
      throw new Error("Empty text provided for Azure TTS synthesis");
    }

    if (!this.isConfigured()) {
      throw new Error("AZURE_SPEECH_KEY is not configured in .env");
    }

    const cleanLang = (request.languageCode || "hi").split("-")[0];
    const selectedVoice = request.voiceName || AZURE_VOICE_MAP[cleanLang] || `${cleanLang}-IN-Neural`;
    const ssml = `<speak version='1.0' xml:lang='${request.languageCode || 'hi-IN'}'><voice name='${selectedVoice}'>${cleanText}</voice></speak>`;

    const url = `https://${config.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.azureSpeechKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "BharatBridge"
      },
      body: ssml
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown Azure TTS error");
      throw new Error(`Azure TTS HTTP ${response.status}: ${errText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    return {
      audio: base64Audio,
      format: "audio/mp3",
      provider: this.name,
      requestId: request.requestId,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime
    };
  }
}
