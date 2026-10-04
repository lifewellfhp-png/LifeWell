import type { Request, Response } from 'express';
import { chatSchema, fieldErrors } from '../validation/schemas.js';
import { detectCrisis, CRISIS_RESPONSE } from '../lib/chatCrisis.js';
import { getPsychiatricStatePricing, getInsurancePlans, getServicesList, getProviderInfo, CHAT_NAP } from '../lib/chatFacts.js';
import { buildSystemPrompt } from '../lib/chatPrompt.js';
import { callGemini, GeminiNotConfiguredError } from '../lib/geminiClient.js';
import { badRequest } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Public chat assistant. Deliberately stateless and read-only: no lead is
 * stored, no email is sent, no chat content is ever written to the
 * database or logged. The only persistence-adjacent call anywhere in this
 * path is a read of the public fees/self_pay CMS row for live pricing.
 *
 * Crisis-language detection runs BEFORE Gemini is called at all — on a
 * match, this returns CRISIS_RESPONSE directly, with no network call to
 * Google and nothing for Gemini to possibly mishandle.
 */
export async function handleChat(req: Request, res: Response): Promise<void> {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Please correct the highlighted fields and try again.', fieldErrors(parsed.error));
  }

  const { message, history } = parsed.data;

  if (detectCrisis(message)) {
    res.json({ success: true, message: CRISIS_RESPONSE });
    return;
  }

  try {
    const [pricing, insurance, services, provider] = await Promise.all([
      getPsychiatricStatePricing(),
      getInsurancePlans(),
      getServicesList(),
      getProviderInfo(),
    ]);
    const systemPrompt = buildSystemPrompt(pricing, insurance, services, provider);
    const reply = await callGemini({ systemPrompt, history, message });
    res.json({ success: true, message: reply });
  } catch (err) {
    const isNotConfigured = err instanceof GeminiNotConfiguredError;
    logger.error('chat reply failed', {
      reason: isNotConfigured ? 'not configured' : err instanceof Error ? err.message : 'unknown',
    });
    res.json({
      success: true,
      message: `I'm having trouble connecting right now. Please call our office at ${CHAT_NAP.phone}.`,
    });
  }
}
