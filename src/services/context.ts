/**
 * BharatBridge Session-Isolated Conversation Context Manager
 * Enforces strict rolling 4-sentence memory per session ID.
 * Prevents cross-session context leakage (Session A memory never leaks into Session B).
 */

import { ContextItem } from "../types/provider";

export class ConversationContextManager {
  private sessionContextMap: Map<string, ContextItem[]> = new Map();
  private maxContextLength = 4;

  /**
   * Add a finalized original/translated sentence pair to a session's rolling context memory.
   */
  public addContext(sessionId: string, originalText: string, translatedText: string): void {
    if (!sessionId || !originalText || !translatedText) return;

    if (!this.sessionContextMap.has(sessionId)) {
      this.sessionContextMap.set(sessionId, []);
    }

    const contextList = this.sessionContextMap.get(sessionId)!;
    contextList.push({
      originalText: originalText.trim(),
      translatedText: translatedText.trim()
    });

    // Enforce rolling 4-sentence limit
    if (contextList.length > this.maxContextLength) {
      this.sessionContextMap.set(sessionId, contextList.slice(-this.maxContextLength));
    }
  }

  /**
   * Retrieve the rolling context memory for a specific session.
   */
  public getContext(sessionId: string): ContextItem[] {
    if (!sessionId || !this.sessionContextMap.has(sessionId)) {
      return [];
    }
    return this.sessionContextMap.get(sessionId) || [];
  }

  /**
   * Format recent context items into an LLM prompt memory string.
   */
  public getFormattedContextPrompt(sessionId: string): string {
    const context = this.getContext(sessionId);
    if (context.length === 0) return "";

    return `Recent Conversation Context:\n` +
      context.map((c, i) => `[${i + 1}] Original: "${c.originalText}" -> Translated: "${c.translatedText}"`).join("\n") +
      `\n\n`;
  }

  /**
   * Safely purge context memory when a session ends or is deleted.
   */
  public clearContext(sessionId: string): void {
    if (sessionId) {
      this.sessionContextMap.delete(sessionId);
    }
  }
}

export const contextManager = new ConversationContextManager();
