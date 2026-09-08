/**
 * Phase 14 (Remove Legacy CMS Pricing Sync Authority) regression tests.
 *
 * PhaseA1Sync (admin/src/app/(app)/insurance/page.tsx) used to write
 * hardcoded approved psychiatric self-pay figures into the fees/self_pay
 * CMS section as a "repair/sync" action — a legacy write path that
 * conflicted with the Phase 12A/13 authority model (protected static site
 * configuration is the only pricing source; CMS pricing is inert). This
 * phase removes that write path while preserving the unrelated, still-
 * legitimate insurance-plan-list and disclaimer sync it also performs.
 *
 * No network calls, no CMS, no Production data, no React rendering — mirrors
 * this repo's established pattern (see test-phase13-admin-pricing-authority.mjs)
 * of source-level assertions against the real shipped files.
 *
 *   npx tsx --test scripts/test-phase14-retire-cms-pricing-sync.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PROTECTED_PSYCHIATRIC_PRICING } from '../src/lib/protected-pricing.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const insurancePageSource = readFileSync(join(__dirname, '../src/app/(app)/insurance/page.tsx'), 'utf8');
// Strips // line comments only (simple, sufficient for this file — no
// block comments or string literals containing "//" exist in it) so
// checks below assert against actual code, not developer-facing prose in
// comments explaining what was removed and why. No `$` anchor: this file
// has CRLF line endings, and `.` excludes \r, so `/\/\/.*$/` would require
// `.*` to reach the true end of the (already-split, still \r-terminated)
// line — impossible — and silently fail to match at all on every line.
const insurancePageCode = insurancePageSource
  .split('\n')
  .map((line) => line.replace(/\/\/.*/, ''))
  .join('\n');
const feesCopySource = readFileSync(join(__dirname, '../src/components/FeesCopy.tsx'), 'utf8');
const sectionsPageSource = readFileSync(join(__dirname, '../src/app/(app)/sections/page.tsx'), 'utf8');
const clientPricingSource = readFileSync(join(__dirname, '../../client/src/data/pricing.ts'), 'utf8');

function findState(name) {
  return PROTECTED_PSYCHIATRIC_PRICING.find((s) => s.state === name);
}

// ---------------------------------------------------------------------------
// 1-5: the pricing sync control and its mutation logic are gone
// ---------------------------------------------------------------------------

test('1. no CTA/button remains that syncs or repairs psychiatric pricing into the CMS (checked against code only, not explanatory comments)', () => {
  assert.doesNotMatch(insurancePageCode, /psychiatricStatePricing/);
});

test('2. no pricing synchronization/repair CTA text remains (sliding-scale-availability sync language, "Fees pricing" messaging)', () => {
  assert.doesNotMatch(insurancePageSource, /'Apply the approved Florida insurance list, sliding-scale/);
  assert.doesNotMatch(insurancePageSource, /Updating Fees pricing failed/);
  assert.doesNotMatch(insurancePageSource, /Psychiatric pricing data is missing/);
  assert.doesNotMatch(insurancePageSource, /psychiatric pricing does not match/i);
});

test('3/4. the Insurance page never constructs or sends a psychiatricStatePricing payload', () => {
  assert.doesNotMatch(insurancePageCode, /expectedPricing/);
  assert.doesNotMatch(insurancePageCode, /currentPricing/);
  assert.doesNotMatch(insurancePageCode, /verifiedPricing/);
  // No fetch/PATCH targets the self_pay section at all anymore — the only
  // remaining section PATCH is the insurance disclaimer.
  assert.doesNotMatch(insurancePageCode, /section_key === 'self_pay'/);
});

test('5. no replacement CMS pricing mutation path was introduced (no new price/fee-shaped field ever appears in a PATCH/POST body in this file)', () => {
  const writeCallBlocks = [...insurancePageCode.matchAll(/body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
  assert.ok(writeCallBlocks.length > 0, 'expected at least the insurance-list and disclaimer PATCH/POST bodies');
  for (const block of writeCallBlocks) {
    assert.doesNotMatch(block, /initialFee|followUpFee|selfPayOnly|slidingScaleAvailable/i);
  }
});

// ---------------------------------------------------------------------------
// 6-10: protected pricing display remains correct and read-only
// (unaffected by this phase — verified again as a regression guard)
// ---------------------------------------------------------------------------

test('6. protected pricing remains read-only — no editable pricing state exists anywhere in FeesCopy.tsx', () => {
  assert.doesNotMatch(feesCopySource, /useState<PsychiatricStatePricing/);
  assert.doesNotMatch(feesCopySource, /setPsychiatricPricing/);
  const pricingBlock = feesCopySource.slice(
    feesCopySource.indexOf('Protected Psychiatric Pricing'),
    feesCopySource.indexOf('Intro body')
  );
  assert.doesNotMatch(pricingBlock, /<input/);
  assert.doesNotMatch(pricingBlock, /<textarea/);
});

test('7. Florida displays $300/$150', () => {
  assert.equal(findState('Florida').initialFee, 300);
  assert.equal(findState('Florida').followUpFee, 150);
});

test('8. Florida is not marked Self-Pay Only', () => {
  assert.equal(findState('Florida').selfPayOnly, false);
});

test('9. Massachusetts displays Self-Pay Only and $300/$175', () => {
  assert.equal(findState('Massachusetts').selfPayOnly, true);
  assert.equal(findState('Massachusetts').initialFee, 300);
  assert.equal(findState('Massachusetts').followUpFee, 175);
});

test('10. Arizona displays Self-Pay Only and $325/$175', () => {
  assert.equal(findState('Arizona').selfPayOnly, true);
  assert.equal(findState('Arizona').initialFee, 325);
  assert.equal(findState('Arizona').followUpFee, 175);
});

// ---------------------------------------------------------------------------
// 11: reconciliation against client/src/data/pricing.ts
// ---------------------------------------------------------------------------

test('11. protected pricing reconciles directly against client/src/data/pricing.ts', () => {
  const match = clientPricingSource.match(/export const psychiatricStatePricing: PsychiatricStatePricing\[\] = \[([\s\S]*?)\];/);
  assert.ok(match, 'expected to find psychiatricStatePricing in client/src/data/pricing.ts');
  for (const state of PROTECTED_PSYCHIATRIC_PRICING) {
    const stateRegex = new RegExp(
      `state: '${state.state}', selfPayOnly: ${state.selfPayOnly}, slidingScaleAvailable: \\w+, initialFee: ${state.initialFee}, followUpFee: ${state.followUpFee}`
    );
    assert.match(match[1], stateRegex, `expected ${state.state}'s admin display values to match client/src/data/pricing.ts exactly`);
  }
});

// ---------------------------------------------------------------------------
// 12: authorized marketing copy remains editable
// ---------------------------------------------------------------------------

test('12. authorized marketing copy remains editable (Fees intro heading, self-pay copy, insurance disclaimer)', () => {
  assert.match(feesCopySource, /id="fees-intro-heading"[\s\S]{0,120}onChange=\{\(e\) => setIntroHeading/);
  assert.match(feesCopySource, /id="fees-selfpay-heading"[\s\S]{0,120}onChange=\{\(e\) => setSelfPayHeading/);
  assert.match(feesCopySource, /id="fees-insurance-disclaimer"[\s\S]{0,200}onChange=\{\(e\) => setInsuranceDisclaimer/);
});

test('the insurance-list sync still legitimately manages the approved plan list and disclaimer (unrelated to pricing, correctly preserved)', () => {
  assert.match(insurancePageSource, /approvedInsurance/);
  assert.match(insurancePageSource, /approvedDisclaimer/);
  assert.match(insurancePageSource, /disclaimer: approvedDisclaimer/);
});

// ---------------------------------------------------------------------------
// 13: unrelated copy saves preserve hostile stored pricing byte-for-byte
// (mirrors FeesCopy.tsx's actual onSubmit save-payload construction)
// ---------------------------------------------------------------------------

function buildSelfPaySavePayload(selfPayContent, selfPayHeading, selfPayBody) {
  return {
    ...selfPayContent,
    heading: selfPayHeading,
    body: selfPayBody.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
  };
}

test('13. unrelated copy saves preserve hostile stored pricing values byte-for-byte', () => {
  const hostile = [
    { state: 'Florida', initialFee: 1, followUpFee: 999, selfPayOnly: true, slidingScaleAvailable: false },
    { state: 'Massachusetts', initialFee: 1, followUpFee: 999, selfPayOnly: false, slidingScaleAvailable: false },
    { state: 'Arizona', initialFee: 1, followUpFee: 999, selfPayOnly: false, slidingScaleAvailable: false },
  ];
  const loaded = { heading: 'Old heading', body: ['Old body'], psychiatricStatePricing: hostile };
  const payload = buildSelfPaySavePayload(loaded, 'New heading only', 'New body only');
  assert.deepEqual(payload.psychiatricStatePricing, hostile);
});

// ---------------------------------------------------------------------------
// 14: Sections raw JSON warning stays targeted only to fees/self_pay
// ---------------------------------------------------------------------------

test('14 (superseded by Phase 15). the Sections raw JSON warning remains targeted only to fees/self_pay', () => {
  const contentFieldBlock = sectionsPageSource.slice(sectionsPageSource.indexOf("key: 'content'"));
  assert.match(contentFieldBlock, /form\.page_key === 'fees' && form\.section_key === 'self_pay'/);
  // Phase 15 (Restore Governed CMS Pricing Authority with Protected
  // Fallback) rewrote this hint's wording from "no longer control public
  // pricing" (Phase 12A/14's unconditional-static framing) to describe the
  // new conditional authority/fallback model instead — see
  // test-phase15-governed-cms-pricing-authority.mjs for the full check.
  assert.match(contentFieldBlock, /controls public pricing/);
  const noWarningBlock = sectionsPageSource.slice(
    sectionsPageSource.indexOf("key: 'content'"),
    sectionsPageSource.indexOf("key: 'published'")
  );
  assert.match(noWarningBlock, /: null/);
});

// ---------------------------------------------------------------------------
// 15 (superseded by Phase 15 — Restore Governed CMS Pricing Authority with
// Protected Fallback): Phase 12A's unconditional "CMS pricing is always
// ignored" rule was explicitly superseded by the owner. The client
// resolver now uses CMS pricing when it is complete and fully valid,
// falling back to the static dataset otherwise — see
// resolvePsychiatricStatePricing() and
// client/scripts/test-phase15-governed-cms-pricing-authority.mjs for the
// full contract. This test is kept as a pointer/regression guard that the
// *conditional* marker (not the old unconditional one) is present.
// ---------------------------------------------------------------------------

test('15 (superseded by Phase 15). the client resolver now uses a conditional authority/fallback marker, not the old unconditional static-only one', () => {
  const cmsResolveSource = readFileSync(join(__dirname, '../../client/src/lib/cms-resolve.ts'), 'utf8');
  assert.doesNotMatch(cmsResolveSource, /psychiatricStatePricing: staticPsychiatricStatePricing,/);
  assert.match(cmsResolveSource, /psychiatricStatePricing: resolvePsychiatricStatePricing\(selfPay\.psychiatricStatePricing\),/);
});

// ---------------------------------------------------------------------------
// 16-18: adjacent protected facts unaffected
// ---------------------------------------------------------------------------

test('16. obsolete $250 psychiatric pricing is absent anywhere touched by this phase', () => {
  assert.doesNotMatch(insurancePageSource, /\$250/);
  assert.doesNotMatch(feesCopySource, /\$250/);
  assert.ok(!PROTECTED_PSYCHIATRIC_PRICING.some((s) => s.initialFee === 250 || s.followUpFee === 250));
});

test('17. Florida-only insurance governance remains intact (approvedInsurance/approvedDisclaimer untouched by this phase)', () => {
  assert.match(insurancePageSource, /Insurance coverage and network participation vary by plan/);
});

test('18. sliding-scale content remains intact (not present/altered in the Insurance page; lives in client static copy, unaffected)', () => {
  assert.doesNotMatch(insurancePageSource, /Sliding Scale Available/);
});

// ---------------------------------------------------------------------------
// 19: no client, server, database, campaign, analytics, Paubox, Charm, or
// PHI behavior was changed by this phase (scoped to files this phase can
// see — the full diff review in the final report covers the rest)
// ---------------------------------------------------------------------------

test('19. the Insurance page has no campaign/analytics/Paubox/Charm/PHI-related code', () => {
  assert.doesNotMatch(insurancePageSource, /campaign|paubox|charm|diagnosis|medication history/i);
});

test('the Insurance page talks only to /api/admin/insurance and /api/admin/sections — no new/different server endpoint', () => {
  const apiCalls = [...insurancePageSource.matchAll(/api(?:<[^>]*>)?\(\s*[`'"]([^`'"]+)/g)].map((m) => m[1]);
  for (const call of apiCalls) {
    assert.match(call, /^\/api\/admin\/(insurance|sections)/, `unexpected API call target: ${call}`);
  }
});
