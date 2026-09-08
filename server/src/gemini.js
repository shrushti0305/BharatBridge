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
 * Optional Gemini Text Translation fallback for text segments.
 */
export async function translateWithGemini({ text, sourceLangCode, targetLangCodes }) {
  if (!ai) return null;

  const prompt = `Translate the following text spoken in ${sourceLangCode} into these target languages: ${targetLangCodes.join(", ")}.
Return ONLY a valid JSON object mapping each language code to its translated text string. Example: {"hi": "...", "mr": "..."}.

Text to translate:
"${text}"`;

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
