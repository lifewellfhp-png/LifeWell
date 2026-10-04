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

/**
 * Mirror of client/src/data/marketing.ts's insuranceCarriers names (Florida
 * only — see client/src/components/sections/FeesPageContent.tsx's "Accepted
 * Insurance Plans — Florida Only" heading). Used only if the live
 * `insurance_plans` table is unreachable; the names-only list below omits
 * logos, which the chat has no use for.
 */
export const CHAT_INSURANCE_FALLBACK: string[] = [
  'AVMED Florida Exchange',
  'Florida Exchange',
  'Oscar Health Plan',
  'UBH General',
  'Veterans Affairs Coordinated Care Network Region 3',
  'Oxford (Commercial)',
  'Aetna (Commercial)',
  'First Health (Coventry Health Care)',
  'Cigna (Commercial)',
  'Medicaid',
  'Medicare',
  'UHC Medicare Advantage',
  'Optum',
  'Curative',
  'TRICARE',
];

/**
 * Live insurance payer names for the chat system prompt. Reads the same
 * `insurance_plans` table the public /fees-insurance page resolves
 * (published rows only, same ordering), falling back to the static mirror
 * above on any missing config, query error, or empty result.
 */
export async function getInsurancePlans(): Promise<string[]> {
  if (!supabaseConfigured()) return CHAT_INSURANCE_FALLBACK;
  try {
    const { data, error } = await getSupabase()
      .from('insurance_plans')
      .select('name')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return CHAT_INSURANCE_FALLBACK;
    const names = data.map((r) => r.name).filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
    return names.length ? names : CHAT_INSURANCE_FALLBACK;
  } catch (err) {
    logger.error('chat insurance fetch failed, using fallback', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return CHAT_INSURANCE_FALLBACK;
  }
}

/** Mirror of client/src/data/generated/services.ts's service titles. */
export const CHAT_SERVICES_FALLBACK: string[] = [
  'Psychiatric Evaluations',
  'Medication Management',
  'Treatment for Depression, Anxiety, ADHD, Bipolar Disorder & PTSD',
  'Follow-Up Visits for Ongoing Mental Health Care',
  'Annual Physicals & Preventive Screenings',
  'Chronic Disease Management',
  'Preventive Care',
  'Sick Visits (Acute Primary Care – Adults 18+)',
  'Weight Management',
  'Wellness and Lifestyle Counseling',
  'Lab Testing Coordination',
];

/**
 * Live service titles for the chat system prompt. Reads the same
 * `services` table the public /our-services page resolves (published rows
 * only, same ordering), falling back to the static mirror above on any
 * missing config, query error, or empty result.
 */
export async function getServicesList(): Promise<string[]> {
  if (!supabaseConfigured()) return CHAT_SERVICES_FALLBACK;
  try {
    const { data, error } = await getSupabase()
      .from('services')
      .select('title')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return CHAT_SERVICES_FALLBACK;
    const titles = data.map((r) => r.title).filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
    return titles.length ? titles : CHAT_SERVICES_FALLBACK;
  } catch (err) {
    logger.error('chat services fetch failed, using fallback', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return CHAT_SERVICES_FALLBACK;
  }
}

export type ChatProviderInfo = { name: string; credentials: string; role: string };

/** Mirror of client/src/data/provider.ts's name/credentials/role. */
export const CHAT_PROVIDER_FALLBACK: ChatProviderInfo = {
  name: 'Lourdie Chachoute',
  credentials: 'APRN, FNP-C, PMHNP-BC, RRT, CCRN',
  role: 'Psychiatric-Mental Health Nurse Practitioner',
};

/**
 * Live provider info for the chat system prompt. Reads the same
 * `providers` table the public /bio page resolves (first published row
 * with a name), falling back to the static mirror above on any missing
 * config, query error, or empty result.
 */
export async function getProviderInfo(): Promise<ChatProviderInfo> {
  if (!supabaseConfigured()) return CHAT_PROVIDER_FALLBACK;
  try {
    const { data, error } = await getSupabase()
      .from('providers')
      .select('name, credentials, title')
      .neq('published', false);
    if (error || !data || data.length === 0) return CHAT_PROVIDER_FALLBACK;
    const row = data.find((r) => typeof r.name === 'string' && r.name.trim().length > 0);
    if (!row) return CHAT_PROVIDER_FALLBACK;
    return {
      name: String(row.name),
      credentials: typeof row.credentials === 'string' && row.credentials ? row.credentials : CHAT_PROVIDER_FALLBACK.credentials,
      role: typeof row.title === 'string' && row.title ? row.title : CHAT_PROVIDER_FALLBACK.role,
    };
  } catch (err) {
    logger.error('chat provider fetch failed, using fallback', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return CHAT_PROVIDER_FALLBACK;
  }
}
