import { getSupabase, supabaseConfigured } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Chat-assistant facts: NAP (name/address/phone) and pricing, mirrored by
 * number from the Client. Admin and Client are separate, independently
 * deployed Vercel projects with zero shared code (see
 * admin/src/lib/protected-pricing.ts), and the Server is a third,
 * equally separate deployment — so this file cannot literally import
 * client/src/data/site.ts or client/src/data/pricing.ts. It mirrors their
 * values instead. server/scripts/test-chat-nap-reconciliation.mjs asserts
 * these stay byte-identical to the Client's copies.
 */

export type PsychiatricStatePricing = {
  state: string;
  selfPayOnly: boolean;
  slidingScaleAvailable: boolean;
  initialFee: number;
  followUpFee: number;
};

export type PricingTier = {
  name: string;
  initialFee: number;
  initialDuration: string;
  followUpFee: number;
  followUpDuration: string;
};

export const CHAT_NAP = {
  name: 'LifeWell Family Health & Psychiatry',
  phone: '(407) 603-1717',
  phoneHref: 'tel:+14076031717',
  email: 'contact@lifewellfhp.com',
  address: '3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828',
  hours: [
    'Monday – Friday: 8:00 AM – 10:00 PM EST',
    'Saturday – Sunday: 7:00 AM – 10:00 PM EST',
  ],
  crisisLine: '988 Suicide & Crisis Lifeline',
  crisisPhone: '988',
};

/** Non-psychiatric self-pay tiers — never CMS-governed anywhere in this codebase, always static. */
export const CHAT_PRICING_TIERS: PricingTier[] = [
  { name: 'Primary Care', initialFee: 135, initialDuration: '60 minutes', followUpFee: 85, followUpDuration: '30 minutes' },
  { name: 'Weight Management', initialFee: 125, initialDuration: '60 minutes', followUpFee: 85, followUpDuration: '30 minutes' },
];

/** Approved fallback — used whenever the CMS has no complete, valid psychiatricStatePricing collection. */
export const CHAT_PRICING_FALLBACK: PsychiatricStatePricing[] = [
  { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 250, followUpFee: 150 },
  { state: 'Massachusetts', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 350, followUpFee: 175 },
  { state: 'Arizona', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 325, followUpFee: 165 },
];

/**
 * Fixed governance facts, not CMS-editable anywhere in this codebase (see
 * client/src/lib/cms-resolve.ts's PSYCHIATRIC_PRICING_GOVERNANCE, which this
 * is a server-side port of). Only initialFee/followUpFee ever come from CMS.
 */
const PSYCHIATRIC_PRICING_GOVERNANCE: Record<string, { selfPayOnly: boolean; slidingScaleAvailable: boolean }> = {
  Florida: { selfPayOnly: false, slidingScaleAvailable: true },
  Massachusetts: { selfPayOnly: true, slidingScaleAvailable: true },
  Arizona: { selfPayOnly: true, slidingScaleAvailable: true },
};

const PSYCHIATRIC_PRICING_STATE_ORDER = ['Florida', 'Massachusetts', 'Arizona'] as const;

function isValidPricingFee(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Identical all-or-nothing validation contract to the Client's
 * resolvePsychiatricStatePricing(): must be exactly 3 entries, one per
 * canonical state, each with a finite positive fee and governance flags
 * matching the fixed table exactly. Any single failure anywhere discards
 * the whole collection and falls back to CHAT_PRICING_FALLBACK.
 */
export function resolvePsychiatricStatePricing(raw: unknown): PsychiatricStatePricing[] {
  if (!Array.isArray(raw) || raw.length !== PSYCHIATRIC_PRICING_STATE_ORDER.length) {
    return CHAT_PRICING_FALLBACK;
  }
  const byState = new Map<string, PsychiatricStatePricing>();
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return CHAT_PRICING_FALLBACK;
    const row = item as Record<string, unknown>;
    const state = row.state;
    const governance = typeof state === 'string' ? PSYCHIATRIC_PRICING_GOVERNANCE[state] : undefined;
    if (!governance || byState.has(state as string)) return CHAT_PRICING_FALLBACK;
    if (!isValidPricingFee(row.initialFee) || !isValidPricingFee(row.followUpFee)) return CHAT_PRICING_FALLBACK;
    if (row.selfPayOnly !== governance.selfPayOnly) return CHAT_PRICING_FALLBACK;
    if (row.slidingScaleAvailable !== governance.slidingScaleAvailable) return CHAT_PRICING_FALLBACK;
    byState.set(state as string, {
      state: state as string,
      ...governance,
      initialFee: row.initialFee,
      followUpFee: row.followUpFee,
    });
  }
  if (byState.size !== PSYCHIATRIC_PRICING_STATE_ORDER.length) return CHAT_PRICING_FALLBACK;
  return PSYCHIATRIC_PRICING_STATE_ORDER.map((state) => byState.get(state)!);
}

/**
 * Live psychiatric pricing for the chat system prompt. Reads the same
 * `site_sections` (page_key:'fees', section_key:'self_pay') row the public
 * site resolves, validated with the identical contract above. Degrades to
 * CHAT_PRICING_FALLBACK on any missing config, query error, or invalid
 * shape — never throws, so a Supabase hiccup never breaks the chat route.
 */
export async function getPsychiatricStatePricing(): Promise<PsychiatricStatePricing[]> {
  if (!supabaseConfigured()) return CHAT_PRICING_FALLBACK;
  try {
    const { data, error } = await getSupabase()
      .from('site_sections')
      .select('*')
      .eq('page_key', 'fees')
      .eq('section_key', 'self_pay')
      .eq('published', true)
      .maybeSingle();
    if (error || !data) return CHAT_PRICING_FALLBACK;
    const content = data.content as Record<string, unknown> | null;
    return resolvePsychiatricStatePricing(content?.psychiatricStatePricing);
  } catch (err) {
    logger.error('chat pricing fetch failed, using fallback', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return CHAT_PRICING_FALLBACK;
  }
}
