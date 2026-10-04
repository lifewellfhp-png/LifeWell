import { GoogleGenAI } from '@google/genai';
import { env, geminiConfigured } from '../config/env.js';

/**
 * The single isolated seam that talks to Google's Gemini API. Nothing else
 * in this codebase imports @google/genai or reads GEMINI_API_KEY/
 * GEMINI_MODEL directly — every other chat file (chatFacts, chatCrisis,
 * chatPrompt, the controller's own validation/short-circuit logic) is a
 * pure function testable with zero network calls. This is the one function
 * that genuinely cannot be tested without a real key, by design.
 */

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return client;
}

export type ChatHistoryEntry = { role: 'user' | 'assistant'; content: string };

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('Chat assistant is not configured.');
    this.name = 'GeminiNotConfiguredError';
  }
}

export async function callGemini(args: {
  systemPrompt: string;
  history: ChatHistoryEntry[];
  message: string;
}): Promise<string> {
  if (!geminiConfigured) throw new GeminiNotConfiguredError();

  const contents = [
    ...args.history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: args.message }] },
  ];

  const response = await getClient().models.generateContent({
    model: env.GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: args.systemPrompt,
      // 300 was found in production to truncate real answers mid-sentence
      // (multi-state pricing/insurance questions routinely need more); 500
      // gives real headroom while the system prompt's own "keep answers
      // short" instruction keeps typical usage well under that ceiling.
      maxOutputTokens: 500,
      // On "thinking"-capable models, internal reasoning tokens are drawn
      // from the same maxOutputTokens budget as the visible reply by
      // default — production testing showed replies truncating mid-
      // sentence even at 500 tokens because thinking consumed an
      // unpredictable share of it first. A short customer-facing Q&A
      // assistant has no need for extended reasoning, so thinking is
      // disabled outright, leaving the full budget for the visible answer.
      // (Harmlessly ignored by non-thinking models.)
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}
