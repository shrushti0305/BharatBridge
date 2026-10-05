import { ITranslationProvider, TranslationRequest, TranslationResponse } from "./interface";
import { config } from "../../config/env";

export class AzureTranslationProvider implements ITranslationProvider {
  public name = "azure-translator";

  public isConfigured(): boolean {
    return Boolean(config.azureTranslatorKey);
  }

  public async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    const cleanText = request.text.trim();
    if (!cleanText) {
      return {
        translatedText: "",
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        provider: this.name,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTimeMs: 0
      };
    }

    if (!this.isConfigured()) {
      throw new Error("AZURE_TRANSLATOR_KEY is not configured in .env");
    }

    const cleanTarget = request.targetLanguage.split("-")[0];
    const cleanSource = request.sourceLanguage ? request.sourceLanguage.split("-")[0] : "";
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${cleanTarget}${cleanSource ? `&from=${cleanSource}` : ''}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.azureTranslatorKey,
        "Ocp-Apim-Subscription-Region": config.azureTranslatorRegion,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([{ text: cleanText }])
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Azure Translator HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const translatedText = data[0]?.translations[0]?.text || cleanText;

    return {
      translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      provider: this.name,
      requestId: request.requestId,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime
    };
  }
}
