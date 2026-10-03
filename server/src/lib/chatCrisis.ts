import { CHAT_NAP } from './chatFacts.js';

/**
 * Deterministic crisis-language gate. Checked BEFORE every Gemini call —
 * the LLM is never trusted to arbitrate this category on its own judgment.
 * On a match, the controller returns CRISIS_RESPONSE directly with no
 * network call to Google at all.
 *
 * Explicit, reviewable array rather than fuzzy/ML matching, matching this
 * codebase's preference for auditable constants (CONTACT_REASONS,
 * PSYCHIATRIC_PRICING_GOVERNANCE) over clever logic a future reader can't
 * verify at a glance. Deliberately errs toward over-triggering — a false
 * positive just shows a safe fixed message; a false negative is the
 * unacceptable failure mode for a psychiatric practice's public chat.
 */
export const CRISIS_KEYWORDS = [
  'suicide',
  'suicidal',
  'kill myself',
  'end my life',
  'ending my life',
  'end it all',
  'want to die',
  'wish i was dead',
  'wish i were dead',
  'better off dead',
  'no reason to live',
  "can't go on",
  'cant go on',
  'hurt myself',
  'harm myself',
  'self harm',
  'self-harm',
  'cutting myself',
  'overdose',
  'not worth living',
  'planning to die',
  'going to kill',
  'going to end',
  'final goodbye',
  'this is goodbye',
  "won't be here",
  'wont be here',
  'tired of living',
  'kill me',
  'hang myself',
] as const;

export function detectCrisis(message: string): boolean {
  const normalized = message.toLowerCase();
  return CRISIS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export const CRISIS_RESPONSE =
  'It sounds like you may be going through something very difficult. Please reach out for immediate support: ' +
  `call or text ${CHAT_NAP.crisisPhone} (${CHAT_NAP.crisisLine}), or call 911 if you are in immediate danger. ` +
  `You're also welcome to call our office directly at ${CHAT_NAP.phone}.`;
