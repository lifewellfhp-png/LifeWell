/**
 * Regression tests for P7-3: sliding-scale wording clarity on
 * /fees-insurance.
 *
 * Context: "Sliding Scale Available" was a single hardcoded JSX text node
 * in FeesPageContent.tsx, rendered once per state card whenever
 * pricing.slidingScaleAvailable is true (currently true for all three
 * states in data/pricing.ts) — no CMS involvement at all, confirmed by a
 * repo-wide grep finding exactly one occurrence. This is a pure,
 * code-only wording change.
 *
 * No network calls, no CMS, no production data.
 *
 *   npx tsx --test scripts/test-sliding-scale-wording.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { psychiatricStatePricing } from '../src/data/pricing.ts';
import { telehealthStates, getTelehealthState } from '../src/data/telehealth-states.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const feesSource = readFileSync(join(__dirname, '../src/components/sections/FeesPageContent.tsx'), 'utf8');

const APPROVED_WORDING = 'Sliding Scale Available — Contact us to ask about eligibility and availability.';

/* ------------------------------------------------------- 1. exact wording --- */

test('1. the exact approved sliding-scale wording appears in the Fees & Insurance pricing presentation', () => {
  assert.match(feesSource, /Sliding Scale Available — Contact us to ask about eligibility and availability\./);
  // Confirm it's still gated by the same per-state flag as before, not a
  // standalone/duplicated block.
  const idx = feesSource.indexOf(APPROVED_WORDING);
  const before = feesSource.slice(Math.max(0, idx - 200), idx);
  assert.match(before, /pricing\.slidingScaleAvailable \? \(/);
});

test('1b. the old, less-clear "Sliding Scale Available" bare label no longer exists on its own', () => {
  // The approved wording must be the WHOLE rendered string, not the old
  // short label left in place alongside new filler text elsewhere.
  const bareLabelPattern = />Sliding Scale Available<\/p>/;
  assert.doesNotMatch(feesSource, bareLabelPattern);
});

/* --------------------------------------------- 2, 3. no invented facts --- */

test('2. no invented sliding-scale dollar amount is introduced', () => {
  const idx = feesSource.indexOf(APPROVED_WORDING);
  const nearby = feesSource.slice(Math.max(0, idx - 50), idx + APPROVED_WORDING.length + 50);
  assert.doesNotMatch(nearby, /\$\d/);
});

test('3. no eligibility criteria, guarantee, income threshold, or timeline language is introduced', () => {
  const forbidden = [
    /income/i,
    /qualif(y|ies|ication)/i,
    /guarantee/i,
    /automatic(ally)? discount/i,
    /\d+\s*%/,
    /within \d+ (day|week|business)/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(APPROVED_WORDING, pattern, `approved wording must not match ${pattern}`);
  }
  // And confirm nothing was added directly around it either.
  const idx = feesSource.indexOf(APPROVED_WORDING);
  const nearby = feesSource.slice(Math.max(0, idx - 100), idx + APPROVED_WORDING.length + 100);
  for (const pattern of forbidden) {
    assert.doesNotMatch(nearby, pattern, `surrounding markup must not match ${pattern}`);
  }
});

/* ---------------------------------------------------- 4-6. pricing intact --- */

test('4. Florida pricing remains $300 / $150', () => {
  const fl = psychiatricStatePricing.find((p) => p.state === 'Florida');
  assert.equal(fl.initialFee, 300);
  assert.equal(fl.followUpFee, 150);
});

test('5. Massachusetts pricing remains $300 / $175', () => {
  const ma = psychiatricStatePricing.find((p) => p.state === 'Massachusetts');
  assert.equal(ma.initialFee, 300);
  assert.equal(ma.followUpFee, 175);
});

test('6. Arizona pricing remains $325 / $175', () => {
  const az = psychiatricStatePricing.find((p) => p.state === 'Arizona');
  assert.equal(az.initialFee, 325);
  assert.equal(az.followUpFee, 175);
});

/* ------------------------------------------------- 7, 8. state/insurance --- */

test('7. Massachusetts and Arizona remain self-pay only', () => {
  const ma = psychiatricStatePricing.find((p) => p.state === 'Massachusetts');
  const az = psychiatricStatePricing.find((p) => p.state === 'Arizona');
  assert.equal(ma.selfPayOnly, true);
  assert.equal(az.selfPayOnly, true);
  const flPricing = psychiatricStatePricing.find((p) => p.state === 'Florida');
  assert.equal(flPricing.selfPayOnly, false);
});

test('8. Florida insurance content remains Florida-only', () => {
  assert.match(feesSource, /Accepted Insurance Plans — Florida Only/);
  assert.match(feesSource, /Massachusetts and Arizona psychiatric visits are self-pay only/i);
});

/* ------------------------------------------------ 9. booking unaffected --- */

test('9. P7-1 booking tracking is unaffected by this change', () => {
  const matches = feesSource.match(/trackAs="booking_click"/g) || [];
  assert.equal(matches.length, 3, 'Fees & Insurance should still have exactly 3 booking_click CTAs (unchanged from before P7-3)');
  // The sliding-scale text itself must never be wrapped in a tracked control.
  const idx = feesSource.indexOf(APPROVED_WORDING);
  const nearby = feesSource.slice(Math.max(0, idx - 150), idx + APPROVED_WORDING.length + 150);
  assert.doesNotMatch(nearby, /trackAs/);
});

/* ---------------------------------------------- 10. P7-2 unaffected --- */

test('10. P7-2 state pricing (telehealth state pages) is unaffected by this change', () => {
  const ma = getTelehealthState('massachusetts');
  const az = getTelehealthState('arizona');
  const fl = getTelehealthState('florida');
  assert.equal(ma.selfPayInitialFee, 300);
  assert.equal(ma.selfPayFollowUpFee, 175);
  assert.equal(az.selfPayInitialFee, 325);
  assert.equal(az.selfPayFollowUpFee, 175);
  assert.deepEqual(ma.pricingCta, { label: 'View Fees & Insurance', href: '/fees-insurance' });
  assert.deepEqual(az.pricingCta, { label: 'View Fees & Insurance', href: '/fees-insurance' });
  assert.deepEqual(ma.secondaryCta, { label: 'Meet Your Provider', href: '/bio' });
  assert.deepEqual(az.secondaryCta, { label: 'Meet Your Provider', href: '/bio' });
  assert.equal(fl.selfPayInitialFee, null);
  assert.equal(telehealthStates.length, 3);
});
