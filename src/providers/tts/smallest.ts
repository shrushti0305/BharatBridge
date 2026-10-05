import { ITTSProvider, TTSRequest, TTSResponse } from "./interface";
import { config } from "../../config/env";

export class SmallestTTSProvider implements ITTSProvider {
  public name = "smallest-waves";

  public isConfigured(): boolean {
    return Boolean(config.smallestApiKey);
  }

  public async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const startTime = Date.now();
    const cleanText = request.text.trim();
    if (!cleanText) {
      throw new Error("Empty text provided for TTS synthesis");
    }

    if (!this.isConfigured()) {
      throw new Error("SMALLEST_API_KEY is not configured in .env");
    }

    const langCode = (request.languageCode || "hi").split("-")[0].toLowerCase();
    const isMale = request.gender === "male";

    let defaultVoice = isMale ? "arman" : "radhika";
    if (langCode === "mr") defaultVoice = "diya";
    else if (langCode === "ta") defaultVoice = "raman";
    else if (langCode === "en") defaultVoice = "emily";

    const selectedVoice = request.voiceName || (config.smallestVoiceId !== "emily" && config.smallestVoiceId) || defaultVoice;
    const url = "https://waves-api.smallest.ai/api/v1/lightning/get_speech";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.smallestApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: cleanText.slice(0, 500),
        voice_id: selectedVoice,
        sample_rate: 24000,
        speed: 1.0,
        add_wav_header: false
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown Smallest.ai error");
      throw new Error(`Smallest.ai HTTP ${response.status}: ${errText}`);
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
