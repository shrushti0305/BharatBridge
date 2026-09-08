import { GoogleGenAI } from "@google/genai";
import { LANGUAGE_BY_CODE } from "./languages.js";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-2.0-flash";

/**
 * Generate structured post-session bullet point summary using Gemini 2.0 Flash.
 */
export async function summarizeWithGemini({ title, sourceLangCode, fullTranscript }) {
  if (!ai) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const sourceLabel = LANGUAGE_BY_CODE[sourceLangCode]?.label || sourceLangCode;

  const prompt = `You are a real-time event assistant. Summarize this live presentation transcript into concise, high-value bullet points. Keep bullets short (10-15 words max). Focus strictly on key facts, decisions, and action items.

Session Title: ${title}
Spoken Language: ${sourceLabel}

Transcript:
"""
${fullTranscript}
"""

Format output in Markdown with these exact sections:
### 📌 Main Summary Points
- [Bullet points summarizing key topics discussed]

### ⚡ Action Items & Key Takeaways
- [Concise next steps or key takeaways]`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  return response.text?.trim() || "";
}

/**
 * Context-Aware Live Translation using Gemini 2.0 Flash.
 * Translates based on full conversational context, session topic, and recent history rather than literal word-for-word translation.
 */
export async function translateWithGemini({ text, sourceLangCode, targetLangCodes, sessionTitle, recentHistory = [] }) {
  if (!ai) return null;

  const sourceLabel = LANGUAGE_BY_CODE[sourceLangCode]?.label || sourceLangCode;
  const historyContext = recentHistory.length > 0
    ? `Recent Spoken Context:\n${recentHistory.map((s, i) => `${i + 1}. "${s}"`).join("\n")}\n\n`
    : "";

  const prompt = `You are a world-class live presentation interpreter.
Session Topic / Title: "${sessionTitle || 'Live Event'}"
Spoken Source Language: ${sourceLabel}

${historyContext}Current Spoken Sentence to Translate:
"${text}"

Translate the current sentence into these target languages: ${targetLangCodes.join(", ")}.

CRITICAL CONTEXT-AWARE TRANSLATION RULES:
1. Do NOT perform literal or word-for-word translation.
2. Translate based on FULL CONTEXT, natural phrasing, cultural nuances, and fluent conversational speech in the target language.
3. Preserve technical terms, names, and core intent accurately while making the sentence sound completely natural to a native listener.
4. Return ONLY a valid JSON object mapping each language code to its translated text string. Example: {"hi": "...", "mr": "..."}.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    return JSON.parse(response.text);
  } catch (err) {
    console.warn("[gemini] Translation error:", err.message);
    return null;
  }
}
