/**
 * Phase 12A (Pricing Authority Hardening) regression tests.
 *
 * Uses the actual mapFees() implementation (client/src/lib/cms-resolve.ts),
 * not a reimplementation — same pattern as test-stats-mapper.mjs. Proves
 * that /fees-insurance's approved psychiatric self-pay pricing (per-state
 * initial/follow-up fee, MA/AZ self-pay-only status) now comes from
 * client/src/data/pricing.ts only, exactly matching the precedent already
 * established for telehealth state pages (mapTelehealthStates() never
 * reads its equivalent selfPayInitialFee/selfPayFollowUpFee fields from
 * CMS either) — a CMS `psychiatricStatePricing` value, however wrong or
 * however shaped, can no longer affect these six approved dollar figures
 * or either state's self-pay-only status.
 *
 * No network calls, no CMS, no Production data.
 *
 *   npx tsx --test scripts/test-phase12a-pricing-authority.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapFees } from '../src/lib/cms-resolve.ts';
import { psychiatricStatePricing as staticPricing, selfPay as staticSelfPay, pricingTiers } from '../src/data/pricing.ts';
import { telehealthStates } from '../src/data/telehealth-states.ts';

function findState(list, name) {
  return list.find((s) => s.state === name);
}

/** A CMS payload with a fees/self_pay section row carrying the given content. */
function cmsWithFeesSelfPay(content) {
  return {
    sections: [{ page_key: 'fees', section_key: 'self_pay', content, published: true, updated_at: '2026-01-01T00:00:00Z' }],
  };
}

// ---------------------------------------------------------------------------
// 1-8: approved figures render correctly with NO CMS row at all
// ---------------------------------------------------------------------------

test('1. Florida initial remains $300 with no CMS row', () => {
  const result = mapFees(null);
  assert.equal(findState(result.psychiatricStatePricing, 'Florida').initialFee, 300);
});

test('2. Florida follow-up remains $150 with no CMS row', () => {
  const result = mapFees(null);
  assert.equal(findState(result.psychiatricStatePricing, 'Florida').followUpFee, 150);
});

test('3. Massachusetts initial remains $300 with no CMS row', () => {
  const result = mapFees(null);
  assert.equal(findState(result.psychiatricStatePricing, 'Massachusetts').initialFee, 300);
});

test('4. Massachusetts follow-up remains $175 with no CMS row', () => {
  const result = mapFees(null);
  assert.equal(findState(result.psychiatricStatePricing, 'Massachusetts').followUpFee, 175);
});

test('5. Arizona initial remains $325 with no CMS row', () => {
  const result = mapFees(null);
  assert.equal(findState(result.psychiatricStatePricing, 'Arizona').initialFee, 325);
});

test('6. Arizona follow-up remains $175 with no CMS row', () => {
  const result = mapFees(null);
  assert.equal(findState(result.psychiatricStatePricing, 'Arizona').followUpFee, 175);
});

test('7. Massachusetts remains Self-Pay Only with no CMS row', () => {
  const result = mapFees(null);
  assert.equal(findState(result.psychiatricStatePricing, 'Massachusetts').selfPayOnly, true);
});

test('8. Arizona remains Self-Pay Only with no CMS row', () => {
  const result = mapFees(null);
  assert.equal(findState(result.psychiatricStatePricing, 'Arizona').selfPayOnly, true);
});

// ---------------------------------------------------------------------------
// 9-16: a hostile/wrong CMS row is completely ignored for every protected fact
// ---------------------------------------------------------------------------

const HOSTILE_CMS = cmsWithFeesSelfPay({
  heading: 'Cash-Pay / Self-Pay Options (CMS heading)',
  body: ['CMS paragraph one.', 'CMS paragraph two.'],
  psychiatricStatePricing: [
    { state: 'Florida', selfPayOnly: true, slidingScaleAvailable: false, initialFee: 1, followUpFee: 999 },
    { state: 'Massachusetts', selfPayOnly: false, slidingScaleAvailable: false, initialFee: 1, followUpFee: 999 },
    { state: 'Arizona', selfPayOnly: false, slidingScaleAvailable: false, initialFee: 1, followUpFee: 999 },
  ],
});

test('9. CMS override attempting Florida initial = $1 is ignored', () => {
  const result = mapFees(HOSTILE_CMS);
  assert.equal(findState(result.psychiatricStatePricing, 'Florida').initialFee, 300);
});

test('10. CMS override attempting Florida follow-up = $999 is ignored', () => {
  const result = mapFees(HOSTILE_CMS);
  assert.equal(findState(result.psychiatricStatePricing, 'Florida').followUpFee, 150);
});

test('11. CMS override attempting MA initial = $1 is ignored', () => {
  const result = mapFees(HOSTILE_CMS);
  assert.equal(findState(result.psychiatricStatePricing, 'Massachusetts').initialFee, 300);
});

test('12. CMS override attempting MA follow-up = $999 is ignored', () => {
  const result = mapFees(HOSTILE_CMS);
  assert.equal(findState(result.psychiatricStatePricing, 'Massachusetts').followUpFee, 175);
});

test('13. CMS override attempting AZ initial = $1 is ignored', () => {
  const result = mapFees(HOSTILE_CMS);
  assert.equal(findState(result.psychiatricStatePricing, 'Arizona').initialFee, 325);
});

test('14. CMS override attempting AZ follow-up = $999 is ignored', () => {
  const result = mapFees(HOSTILE_CMS);
  assert.equal(findState(result.psychiatricStatePricing, 'Arizona').followUpFee, 175);
});

test('15. CMS override attempting to change MA self-pay-only status (false) is ignored', () => {
  const result = mapFees(HOSTILE_CMS);
  assert.equal(findState(result.psychiatricStatePricing, 'Massachusetts').selfPayOnly, true);
});

test('16. CMS override attempting to change AZ self-pay-only status (false) is ignored', () => {
  const result = mapFees(HOSTILE_CMS);
  assert.equal(findState(result.psychiatricStatePricing, 'Arizona').selfPayOnly, true);
});

// ---------------------------------------------------------------------------
// Additional hostile shapes: null/blank/malformed/missing-entirely
// ---------------------------------------------------------------------------

test('a null psychiatricStatePricing CMS value has zero effect', () => {
  const result = mapFees(cmsWithFeesSelfPay({ psychiatricStatePricing: null }));
  assert.deepEqual(result.psychiatricStatePricing, staticPricing);
});

test('a blank-string psychiatricStatePricing CMS value has zero effect', () => {
  const result = mapFees(cmsWithFeesSelfPay({ psychiatricStatePricing: '' }));
  assert.deepEqual(result.psychiatricStatePricing, staticPricing);
});

test('a completely malformed (non-array, non-object-list) psychiatricStatePricing CMS value has zero effect', () => {
  const result = mapFees(cmsWithFeesSelfPay({ psychiatricStatePricing: 'garbage' }));
  assert.deepEqual(result.psychiatricStatePricing, staticPricing);
});

test('psychiatricStatePricing entirely absent from the CMS content object has zero effect', () => {
  const result = mapFees(cmsWithFeesSelfPay({ heading: 'Some heading' }));
  assert.deepEqual(result.psychiatricStatePricing, staticPricing);
});

test('mapFees(null) (no CMS at all) returns exactly the static pricing array, unmodified', () => {
  assert.deepEqual(mapFees(null).psychiatricStatePricing, staticPricing);
});

// ---------------------------------------------------------------------------
// 17-20: CMS editable copy still works; nothing else silently dropped
// ---------------------------------------------------------------------------

test('17. CMS editable marketing copy (self-pay heading/body) still works', () => {
  const result = mapFees(HOSTILE_CMS);
  assert.equal(result.selfPayHeading, 'Cash-Pay / Self-Pay Options (CMS heading)');
  assert.deepEqual(result.selfPayBody, ['CMS paragraph one.', 'CMS paragraph two.']);
});

test('18. CMS section heading (fees/intro) still works', () => {
  const cms = { sections: [{ page_key: 'fees', section_key: 'intro', content: { heading: 'Custom Intro Heading' }, published: true }] };
  const result = mapFees(cms);
  assert.equal(result.introHeading, 'Custom Intro Heading');
});

test('19. CMS non-pricing explanatory fields (insurance disclaimer) still merge correctly', () => {
  const cms = { sections: [{ page_key: 'fees', section_key: 'insurance', content: { disclaimer: 'Custom disclaimer text.' }, published: true }] };
  const result = mapFees(cms);
  assert.equal(result.insuranceDisclaimer, 'Custom disclaimer text.');
});

test('20. no other Fees-page data is silently dropped — every field mapFees() returns is present and correctly typed', () => {
  const result = mapFees(null);
  assert.equal(typeof result.introHeading, 'string');
  assert.equal(typeof result.introBody, 'string');
  assert.equal(typeof result.selfPayHeading, 'string');
  assert.ok(Array.isArray(result.selfPayBody));
  assert.equal(typeof result.insuranceDisclaimer, 'string');
  assert.equal(result.psychiatricStatePricing.length, 3);
});

// ---------------------------------------------------------------------------
// 21-24: adjacent protected facts remain unaffected by this change
// ---------------------------------------------------------------------------

test('21. sliding-scale wording (static source) remains unchanged by this change', () => {
  assert.equal(findState(staticPricing, 'Florida').slidingScaleAvailable, true);
  assert.equal(findState(staticPricing, 'Massachusetts').slidingScaleAvailable, true);
  assert.equal(findState(staticPricing, 'Arizona').slidingScaleAvailable, true);
});

test('22. Florida-only insurance distinction remains unchanged (Florida is not self-pay-only, MA/AZ are)', () => {
  assert.equal(findState(staticPricing, 'Florida').selfPayOnly, false);
  assert.equal(findState(staticPricing, 'Massachusetts').selfPayOnly, true);
  assert.equal(findState(staticPricing, 'Arizona').selfPayOnly, true);
});

test('23. no $250 psychiatric tier reappears anywhere in pricing.ts', () => {
  assert.ok(!pricingTiers.some((t) => t.initialFee === 250 || t.followUpFee === 250));
  assert.ok(!staticPricing.some((s) => s.initialFee === 250 || s.followUpFee === 250));
});

test('24. state pages (telehealth-states.ts) remain consistent with Fees & Insurance (pricing.ts) for MA/AZ', () => {
  const ma = telehealthStates.find((s) => s.code === 'MA');
  const az = telehealthStates.find((s) => s.code === 'AZ');
  assert.equal(ma.selfPayInitialFee, findState(staticPricing, 'Massachusetts').initialFee);
  assert.equal(ma.selfPayFollowUpFee, findState(staticPricing, 'Massachusetts').followUpFee);
  assert.equal(az.selfPayInitialFee, findState(staticPricing, 'Arizona').initialFee);
  assert.equal(az.selfPayFollowUpFee, findState(staticPricing, 'Arizona').followUpFee);
});

// ---------------------------------------------------------------------------
// Self-pay body copy (adjacent to pricing, must remain unaffected)
// ---------------------------------------------------------------------------

test('static selfPay copy still contains the approved 24-hour payment-timing sentence', () => {
  assert.ok(staticSelfPay.body.some((p) => p.includes('due at least 24 hours before the scheduled appointment')));
});
