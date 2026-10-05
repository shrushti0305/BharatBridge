import { ITTSProvider, TTSRequest, TTSResponse } from "./interface";

export class GoogleTTSProvider implements ITTSProvider {
  public name = "google-neural-tts-fallback";

  public isConfigured(): boolean {
    return true; // Always available as emergency fallback
  }

  public async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const startTime = Date.now();
    const cleanText = request.text.trim();
    if (!cleanText) {
      throw new Error("Empty text provided for Google TTS fallback");
    }

    const cleanLang = (request.languageCode || "hi").split("-")[0];
    const shortText = cleanText.slice(0, 200);
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(shortText)}&tl=${cleanLang}&client=tw-ob`;

    const response = await fetch(googleTtsUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });

    if (!response.ok) {
      throw new Error(`Google TTS Fallback HTTP ${response.status}`);
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
