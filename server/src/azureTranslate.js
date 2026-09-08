// Live translation via Azure AI Translator (Text Translation API v3.0).
// Azure's language codes for all 11 supported languages match the ISO codes already used
// throughout this app (hi, mr, bn, ta, te, kn, gu, ml, pa, or, en), so no code mapping is needed.
//
// Free tier: the "F0" Translator resource tier gives 2M characters/month at no cost, which is
// what makes this a good fit for a live-captioning feature.

/**
 * Translate one transcript segment into MULTIPLE target languages in a single Azure call.
 * Returns { [langCode]: translatedText }.
 */
import { translateWithGemini } from "./gemini.js";

/**
 * Translate one transcript segment into MULTIPLE target languages in a single call.
 * Uses Context-Aware Gemini API if configured, falling back to Azure Translator.
 * Returns { [langCode]: translatedText }.
 */
export async function translateSegment({ sourceText, sourceLangCode, targetLangCodes, sessionTitle }) {
  if (targetLangCodes.length === 0) return {};

  // 1. Try Context-Aware Gemini 2.0 Flash Translation
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiResult = await translateWithGemini({
        text: sourceText,
        sourceLangCode,
        targetLangCodes,
        sessionTitle,
      });
      if (geminiResult && typeof geminiResult === "object") {
        const out = {};
        for (const code of targetLangCodes) {
          out[code] = geminiResult[code] || sourceText;
        }
        return out;
      }
    } catch (e) {
      console.warn("[translate] Gemini context translation fallback to Azure:", e.message);
    }
  }

  const azureKey = process.env.AZURE_TRANSLATOR_KEY;
  const azureRegion = process.env.AZURE_TRANSLATOR_REGION;
  const azureEndpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || "https://api.cognitive.microsofttranslator.com").replace(/\/+$/, "");

  if (!azureKey || !azureRegion) {
    throw new Error(
      "AZURE_TRANSLATOR_KEY / AZURE_TRANSLATOR_REGION are not set — add them to server/.env"
    );
  }

  const params = new URLSearchParams({ "api-version": "3.0" });
  if (sourceLangCode && sourceLangCode !== "auto" && sourceLangCode !== "hinglish") {
    params.append("from", sourceLangCode);
  }
  for (const code of targetLangCodes) params.append("to", code);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  let res;
  try {
    res = await fetch(`${azureEndpoint}/translate?${params.toString()}`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azureKey,
        "Ocp-Apim-Subscription-Region": azureRegion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ Text: sourceText }]),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Azure Translator request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  // Response shape: [{ translations: [{ text, to }, ...] }]  — one entry per input text (we send one)
  const translations = data?.[0]?.translations || [];

  const out = {};
  for (const code of targetLangCodes) {
    const match = translations.find((t) => t.to === code);
    out[code] = match?.text || sourceText;
  }
  return out;
}