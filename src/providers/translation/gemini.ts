import { GoogleGenAI } from "@google/genai";
import { ITranslationProvider, TranslationRequest, TranslationResponse } from "./interface";
import { config } from "../../config/env";

const LANGUAGE_NAME_MAP: Record<string, string> = {
  en: "English", hi: "Hindi", bn: "Bengali", te: "Telugu", mr: "Marathi",
  ta: "Tamil", ur: "Urdu", gu: "Gujarati", kn: "Kannada", ml: "Malayalam",
  or: "Odia", pa: "Punjabi", as: "Assamese", ma: "Maithili", me: "Meitei",
  sa: "Sanskrit", ks: "Kashmiri", sd: "Sindhi", doi: "Dogri", kok: "Konkani"
};

export class GeminiTranslationProvider implements ITranslationProvider {
  public name = "gemini";
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    if (config.geminiApiKey) {
      this.aiClient = new GoogleGenAI({
        apiKey: config.geminiApiKey,
        httpOptions: { headers: { "User-Agent": "bharatbridge-build" } }
      });
    }
  }

  public isConfigured(): boolean {
    return Boolean(config.geminiApiKey && this.aiClient);
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

    if (!this.isConfigured() || !this.aiClient) {
      throw new Error("Gemini API key is not configured in .env");
    }

    const cleanTargetCode = (request.targetLanguage || "hi").split("-")[0];
    const targetLangName = LANGUAGE_NAME_MAP[cleanTargetCode] || cleanTargetCode;
    const sourceLangName = request.sourceLanguage ? (LANGUAGE_NAME_MAP[request.sourceLanguage.split("-")[0]] || request.sourceLanguage) : "auto-detected language";

    const contextPrompt = request.context && request.context.length > 0 
      ? `Recent Conversation Context:\n${request.context.slice(-4).map(c => `Original: "${c.originalText}" -> Translated: "${c.translatedText}"`).join("\n")}\n\n`
      : "";

    const systemPrompt = `You are a high-precision, context-aware natural language translator specializing in Indian languages.
${contextPrompt}Translate the following sentence naturally from ${sourceLangName} to ${targetLangName}.

STRICT REQUIREMENTS:
- DO NOT translate word-for-word literally. Translate contextually and idiomatically so it sounds completely natural to a native ${targetLangName} speaker.
- Respect full sentence grammar, phrasing, cultural nuances, and conversational tone.
- Output ONLY the final translated text in ${targetLangName}. Do NOT include quotes, explanations, or notes.

Sentence: "${cleanText}"`;

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let lastError: any = null;

    for (const model of models) {
      try {
        const result = await this.aiClient.models.generateContent({
          model,
          contents: systemPrompt,
          config: { temperature: 0.2 }
        });

        if (result.text && result.text.trim()) {
          const cleanedText = result.text.trim().replace(/^["']|["']$/g, '');
          if (cleanedText) {
            return {
              translatedText: cleanedText,
              sourceLanguage: request.sourceLanguage,
              targetLanguage: request.targetLanguage,
              provider: `${this.name}-${model}`,
              requestId: request.requestId,
              timestamp: Date.now(),
              executionTimeMs: Date.now() - startTime
            };
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(`Gemini translation failed across models: ${lastError?.message || String(lastError)}`);
  }
}
