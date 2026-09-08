import Anthropic from "@anthropic-ai/sdk";
import { LANGUAGE_BY_CODE } from "./languages.js";
import { summarizeWithGemini } from "./gemini.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-3-5-sonnet-20241022";

/**
 * Generate end-of-session speaker notes from the full transcript.
 * (Prioritizes Google Gemini 2.0 Flash, then Anthropic Claude, then Local Fallback)
 */
export async function summarizeSession({ title, sourceLangCode, fullTranscript }) {
  const sourceLabel = LANGUAGE_BY_CODE[sourceLangCode]?.label || sourceLangCode;

  if (!fullTranscript || !fullTranscript.trim()) {
    return "No speech was captured during this session.";
  }

  // 1. Try Google Gemini 2.0 Flash (Free API)
  if (process.env.GEMINI_API_KEY) {
    try {
      const summary = await summarizeWithGemini({ title, sourceLangCode, fullTranscript });
      if (summary) return summary;
    } catch (err) {
      console.warn("[ai] Gemini summary failed, trying Anthropic/local:", err.message);
    }
  }

  // 2. Try Anthropic Claude
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const system = `You write short, concise, high-value bullet-point summaries of spoken session transcripts. Focus strictly on key facts, decisions, and action items. Keep every bullet point brief (10-15 words max). Do not include fluff.`;

      const user = `Session title: ${title}
Original language: ${sourceLabel}

Transcript:
"""
${fullTranscript}
"""

Generate a short bullet-point summary formatted in Markdown with these exact sections:
### 📌 Main Summary Points
- Short bullet points covering key topics discussed.

### ⚡ Action Items & Key Takeaways
- Concise bullet points for next steps or important takeaways.`;

      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 800,
        system,
        messages: [{ role: "user", content: user }],
      });

      const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      if (text) return text;
    } catch (err) {
      console.warn("[ai] Anthropic summary failed, falling back to smart local summarizer:", err.message);
    }
  }

  return generateSmartSummary({ title, sourceLangCode, fullTranscript });
}

function generateSmartSummary({ title, sourceLangCode, fullTranscript }) {
  const sourceLabel = LANGUAGE_BY_CODE[sourceLangCode]?.label || sourceLangCode;
  const rawSentences = fullTranscript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  if (rawSentences.length === 0) {
    return "No speech was captured during this session.";
  }

  const uniqueSentences = Array.from(new Set(rawSentences));
  const mainPoints = uniqueSentences.slice(0, 5).map((s) => `- ${s}`).join("\n");
  const takeaways = uniqueSentences.slice(5, 9).map((s) => `- ${s}`).join("\n");

  let md = `### 📌 Main Summary Points\n${mainPoints}\n`;
  if (takeaways) {
    md += `\n### ⚡ Action Items & Key Takeaways\n${takeaways}\n`;
  }

  return md.trim();
}