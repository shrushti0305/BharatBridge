import { ITranslationProvider, TranslationRequest, TranslationResponse } from "../../providers/translation/interface";
import { GeminiTranslationProvider } from "../../providers/translation/gemini";
import { AzureTranslationProvider } from "../../providers/translation/azure";
import { BhashiniTranslationProvider } from "../../providers/translation/bhashini";
import { config } from "../../config/env";

export class TranslationOrchestrator {
  private providers: Map<string, ITranslationProvider> = new Map();
  private primaryName: string;
  private fallbackName: string;

  constructor() {
    const gemini = new GeminiTranslationProvider();
    const azure = new AzureTranslationProvider();
    const bhashini = new BhashiniTranslationProvider();

    this.providers.set("gemini", gemini);
    this.providers.set("azure", azure);
    this.providers.set("bhashini", bhashini);

    this.primaryName = config.translationPrimary || "gemini";
    this.fallbackName = config.translationFallback || "azure";
  }

  public getProviderStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.providers.forEach((provider, name) => {
      status[name] = provider.isConfigured();
    });
    return status;
  }

  public async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    const cleanText = request.text.trim();
    if (!cleanText) {
      return {
        translatedText: "",
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        provider: "none",
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTimeMs: 0
      };
    }

    // 1. Attempt Primary Provider
    const primaryProvider = this.providers.get(this.primaryName);
    if (primaryProvider && primaryProvider.isConfigured()) {
      try {
        return await primaryProvider.translate(request);
      } catch (err: any) {
        console.warn(`[TranslationOrchestrator] Primary provider (${this.primaryName}) failed:`, err.message || err);
      }
    }

    // 2. Attempt Fallback Provider
    const fallbackProvider = this.providers.get(this.fallbackName);
    if (fallbackProvider && fallbackProvider.isConfigured() && this.fallbackName !== this.primaryName) {
      try {
        return await fallbackProvider.translate(request);
      } catch (err: any) {
        console.warn(`[TranslationOrchestrator] Fallback provider (${this.fallbackName}) failed:`, err.message || err);
      }
    }

    // 3. Attempt Secondary Provider (if Azure/Gemini wasn't already tried)
    for (const [name, provider] of this.providers.entries()) {
      if (name !== this.primaryName && name !== this.fallbackName && provider.isConfigured()) {
        try {
          return await provider.translate(request);
        } catch (err: any) {
          console.warn(`[TranslationOrchestrator] Alternate provider (${name}) failed:`, err.message || err);
        }
      }
    }

    // 4. Emergency Universal Google Translate Fallback (Zero Quota, instant response)
    const targetCode = request.targetLanguage.split("-")[0];
    if (targetCode) {
      try {
        const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetCode}&dt=t&q=${encodeURIComponent(cleanText)}`;
        const gRes = await fetch(gUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (Array.isArray(gData) && gData[0]) {
            const gText = gData[0].map((item: any) => item[0]).filter(Boolean).join("");
            if (gText && gText.trim()) {
              return {
                translatedText: gText.trim(),
                sourceLanguage: request.sourceLanguage,
                targetLanguage: request.targetLanguage,
                provider: "google-translate-fallback",
                requestId: request.requestId,
                timestamp: Date.now(),
                executionTimeMs: Date.now() - startTime
              };
            }
          }
        }
      } catch (gErr) {
        console.warn("[TranslationOrchestrator] Universal Google Translate Fallback error:", gErr);
      }
    }

    // 5. Final Safe Fallback: Return raw text
    return {
      translatedText: cleanText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      provider: "raw-text-fallback",
      requestId: request.requestId,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
      warning: "All translation providers temporarily unavailable. Raw text returned."
    };
  }
}

export const translationOrchestrator = new TranslationOrchestrator();
