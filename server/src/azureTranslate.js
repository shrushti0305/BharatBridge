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
import Anthropic from "@anthropic-ai/sdk";
import { translateWithGemini } from "./gemini.js";
import { LANGUAGE_BY_CODE } from "./languages.js";

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

/**
 * Translate one transcript segment into MULTIPLE target languages using LLM context-aware translation.
 * Prioritizes Gemini 2.0 Flash / Anthropic Claude 3.5 Sonnet (full context, non-literal), falling back to Azure Translator.
 */
export async function translateSegment({ sourceText, sourceLangCode, targetLangCodes, sessionTitle, recentHistory = [] }) {
  if (targetLangCodes.length === 0) return {};

  // 1. Try Context-Aware Gemini 2.0 Flash Translation
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiResult = await translateWithGemini({
        text: sourceText,
        sourceLangCode,
        targetLangCodes,
        sessionTitle,
        recentHistory,
      });
      if (geminiResult && typeof geminiResult === "object") {
        const out = {};
        for (const code of targetLangCodes) {
          out[code] = geminiResult[code] || sourceText;
        }
        return out;
      }
    } catch (e) {
      console.warn("[translate] Gemini context translation fallback to Claude/Azure:", e.message);
    }
  }

  // 2. Try Context-Aware Anthropic Claude Translation
  if (anthropic) {
    try {
      const claudeResult = await translateWithClaude({
        text: sourceText,
        sourceLangCode,
        targetLangCodes,
        sessionTitle,
        recentHistory,
      });
      if (claudeResult && typeof claudeResult === "object") {
        const out = {};
        for (const code of targetLangCodes) {
          out[code] = claudeResult[code] || sourceText;
        }
        return out;
      }
    } catch (e) {
      console.warn("[translate] Claude context translation fallback to Azure:", e.message);
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

async function translateWithClaude({ text, sourceLangCode, targetLangCodes, sessionTitle, recentHistory = [] }) {
  const historyText = recentHistory.length > 0
    ? `Recent Spoken Context:\n${recentHistory.map((s, i) => `${i + 1}. "${s}"`).join("\n")}\n\n`
    : "";
  const sourceLangName = LANGUAGE_BY_CODE[sourceLangCode]?.label || sourceLangCode;
  const targetLangsText = targetLangCodes.map((c) => `${c} (${LANGUAGE_BY_CODE[c]?.label || c})`).join(", ");

  const prompt = `You are a world-class live presentation interpreter.
Session Topic / Title: "${sessionTitle || 'Live Presentation'}"
Spoken Source Language: ${sourceLangName}

${historyText}Current Spoken Sentence to Translate:
"${text}"

Translate the current sentence into these target languages: ${targetLangsText}.

CRITICAL CONTEXT-AWARE TRANSLATION RULES:
1. Do NOT perform literal or word-for-word translation.
2. Translate based on FULL CONTEXT, natural phrasing, cultural nuances, and fluent conversational speech in the target language.
3. Preserve technical terms, names, and core intent accurately while making the sentence sound completely natural to a native listener.
4. Return ONLY a valid JSON object mapping each language code to its translated text string. Example: {"hi": "...", "mr": "..."}. Do not include markdown code blocks.`;

  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleanJson);
}