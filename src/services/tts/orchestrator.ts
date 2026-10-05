import { ITTSProvider, TTSRequest, TTSResponse } from "../../providers/tts/interface";
import { SmallestTTSProvider } from "../../providers/tts/smallest";
import { AzureTTSProvider } from "../../providers/tts/azure";
import { GoogleTTSProvider } from "../../providers/tts/google";
import { config } from "../../config/env";

export class TTSOrchestrator {
  private providers: Map<string, ITTSProvider> = new Map();
  private primaryName: string;
  private fallbackName: string;

  constructor() {
    const smallest = new SmallestTTSProvider();
    const azure = new AzureTTSProvider();
    const google = new GoogleTTSProvider();

    this.providers.set("smallest", smallest);
    this.providers.set("azure", azure);
    this.providers.set("google", google);

    this.primaryName = config.ttsPrimary || "smallest";
    this.fallbackName = config.ttsFallback || "azure";
  }

  public getProviderStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.providers.forEach((provider, name) => {
      status[name] = provider.isConfigured();
    });
    return status;
  }

  public async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const cleanText = request.text.trim();
    if (!cleanText) {
      throw new Error("Empty text provided for TTS orchestrator");
    }

    // 1. Attempt Primary Provider (e.g. Smallest.ai)
    const primaryProvider = this.providers.get(this.primaryName);
    if (primaryProvider && primaryProvider.isConfigured()) {
      try {
        return await primaryProvider.synthesize(request);
      } catch (err: any) {
        console.warn(`[TTSOrchestrator] Primary provider (${this.primaryName}) failed:`, err.message || err);
      }
    }

    // 2. Attempt Fallback Provider (e.g. Azure TTS)
    const fallbackProvider = this.providers.get(this.fallbackName);
    if (fallbackProvider && fallbackProvider.isConfigured() && this.fallbackName !== this.primaryName) {
      try {
        return await fallbackProvider.synthesize(request);
      } catch (err: any) {
        console.warn(`[TTSOrchestrator] Fallback provider (${this.fallbackName}) failed:`, err.message || err);
      }
    }

    // 3. Attempt Universal Emergency Provider (Google TTS)
    const googleProvider = this.providers.get("google");
    if (googleProvider && googleProvider.isConfigured()) {
      try {
        return await googleProvider.synthesize(request);
      } catch (err: any) {
        console.error(`[TTSOrchestrator] Universal emergency Google TTS failed:`, err.message || err);
      }
    }

    throw new Error("All TTS providers failed to synthesize audio stream");
  }
}

export const ttsOrchestrator = new TTSOrchestrator();
