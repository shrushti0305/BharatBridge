/**
 * AI4Bharat Bhashini NMT Translation Provider Adapter (MeitY Government of India)
 * Status: Configured / NEEDS VERIFICATION for live pipeline credentials.
 */

import { ITranslationProvider, TranslationRequest, TranslationResponse } from "./interface";
import { config } from "../../config/env";

export class BhashiniTranslationProvider implements ITranslationProvider {
  public name = "bhashini-nmt";

  public isConfigured(): boolean {
    return Boolean(config.bhashiniApiKey && config.bhashiniPipelineId);
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
      throw new Error("BHASHINI_API_KEY or BHASHINI_PIPELINE_ID is not configured in .env (NEEDS VERIFICATION)");
    }

    const payload = {
      pipelineTasks: [
        {
          taskType: "translation",
          config: {
            language: {
              sourceLanguage: request.sourceLanguage.split("-")[0],
              targetLanguage: request.targetLanguage.split("-")[0]
            },
            pipelineId: config.bhashiniPipelineId
          }
        }
      ],
      inputData: {
        input: [{ source: cleanText }]
      }
    };

    const response = await fetch(config.bhashiniEndpoint, {
      method: "POST",
      headers: {
        "Authorization": config.bhashiniApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Bhashini API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const translatedText = data.pipelineResponse?.[0]?.output?.[0]?.target || cleanText;

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
