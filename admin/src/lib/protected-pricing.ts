/**
 * Phase 13 (Admin Pricing Authority Alignment): the approved psychiatric
 * self-pay figures, for READ-ONLY display in Admin only.
 *
 * Phase 12A locked these facts to a single static authority —
 * client/src/lib/cms-resolve.ts's mapFees() now always reads them from
 * client/src/data/pricing.ts, never from any CMS/database row. Admin and
 * Client are separate, independently-deployed Vercel projects with zero
 * shared code (no shared workspace package exists in this monorepo), so
 * this file cannot literally import client/src/data/pricing.ts — it
 * mirrors those values by number instead. This does NOT create a second
 * editable pricing authority: nothing here is ever written back to the
 * CMS or read by the public site — it exists solely so the Admin UI can
 * show the owner the real, currently-live figures instead of whatever
 * stale value happens to be sitting in the (now-inert) CMS row.
 *
 * scripts/test-phase13-admin-pricing-authority.mjs asserts these values
 * are byte-for-byte identical to client/src/data/pricing.ts's
 * psychiatricStatePricing — if the approved figures are ever legitimately
 * changed, that test will fail here until this file is updated to match,
 * so the two can never silently drift apart.
 */
export type ProtectedPsychiatricPricing = {
  state: string;
  selfPayOnly: boolean;
  initialFee: number;
  followUpFee: number;
};

export const PROTECTED_PSYCHIATRIC_PRICING: readonly ProtectedPsychiatricPricing[] = [
  { state: 'Florida', selfPayOnly: false, initialFee: 300, followUpFee: 150 },
  { state: 'Massachusetts', selfPayOnly: true, initialFee: 300, followUpFee: 175 },
  { state: 'Arizona', selfPayOnly: true, initialFee: 325, followUpFee: 175 },
];
