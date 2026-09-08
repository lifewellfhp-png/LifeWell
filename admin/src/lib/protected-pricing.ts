/**
 * Phase 13 (Admin Pricing Authority Alignment): the approved psychiatric
 * self-pay figures, mirrored here for Admin display and — as of Phase 15
 * (Restore Governed CMS Pricing Authority with Protected Fallback) — for
 * constructing a governed pricing-save payload.
 *
 * Phase 12A originally locked these facts to a single static authority —
 * client/src/lib/cms-resolve.ts's mapFees() read them only from
 * client/src/data/pricing.ts, never from any CMS/database row. Phase 15
 * superseded that unconditional rule per explicit owner authorization: the
 * public site now uses a CMS `psychiatricStatePricing` collection when it
 * is complete and fully valid (see resolvePsychiatricStatePricing() in
 * client/src/lib/cms-resolve.ts), falling back to the static dataset
 * otherwise. `selfPayOnly`/`slidingScaleAvailable` are still fixed
 * governance facts, not freely CMS-editable values — the Admin editor only
 * ever lets the owner change `initialFee`/`followUpFee`, and always sends
 * these two flags' protected values alongside them so a save is valid by
 * construction.
 *
 * Admin and Client are separate, independently-deployed Vercel projects
 * with zero shared code (no shared workspace package exists in this
 * monorepo), so this file cannot literally import client/src/data/
 * pricing.ts — it mirrors those values by number instead.
 * scripts/test-phase13-admin-pricing-authority.mjs and
 * scripts/test-phase15-governed-cms-pricing-authority.mjs both assert
 * these values are byte-for-byte identical to client/src/data/pricing.ts's
 * psychiatricStatePricing — if the approved figures are ever legitimately
 * changed, those tests will fail here until this file is updated to
 * match, so the two can never silently drift apart.
 */
export type ProtectedPsychiatricPricing = {
  state: string;
  selfPayOnly: boolean;
  slidingScaleAvailable: boolean;
  initialFee: number;
  followUpFee: number;
};

export const PROTECTED_PSYCHIATRIC_PRICING: readonly ProtectedPsychiatricPricing[] = [
  { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 300, followUpFee: 150 },
  { state: 'Massachusetts', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 300, followUpFee: 175 },
  { state: 'Arizona', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 325, followUpFee: 175 },
];
