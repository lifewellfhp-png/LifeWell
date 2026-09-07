/**
 * Regression tests for Phase 10B: self-pay payment timing policy
 * correction (client/src/data/pricing.ts, `selfPay.body`).
 *
 * Root cause (proven via a fresh read of the Production public content
 * API + a fresh fetch of the rendered /fees-insurance page): the CMS
 * `fees/self_pay` section's `body` field is an empty array in Production,
 * so client/src/lib/cms-resolve.ts's mapFees() falls back to this file's
 * static `selfPay.body` (selfPayBody.length ? selfPayBody :
 * staticSelfPay.body) — and that static fallback still said "Payment is
 * due at the time services are provided," directly contradicting the
 * owner-approved policy ("due at least 24 hours before the scheduled
 * appointment"). This is a genuine static-content correction (Classification
 * G), not a CMS data issue and not a code/resolver defect — the resolver's
 * CMS-overrides-static behavior is correct; the static fallback text
 * itself was simply stale.
 *
 * Separately (not fixed here — CMS-owned, reported as an owner action):
 * four new Fees FAQs the owner authored (sliding scale, copay, 24-hour
 * payment, cancellation/rescheduling) were saved under category "General"
 * instead of "Fees", so they don't appear on /fees-insurance; one of them
 * (sliding scale) was also saved twice. Both are Admin data-entry issues,
 * not addressed by this test file or this code change.
 *
 *   npx tsx --test scripts/test-selfpay-payment-policy.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { selfPay, psychiatricStatePricing } from '../src/data/pricing.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

test('1. the stale "due at the time services are provided" phrase no longer appears in selfPay.body', () => {
  for (const paragraph of selfPay.body) {
    assert.doesNotMatch(paragraph, /due at the time services are provided/i);
  }
});

test('2. selfPay.body states the approved 24-hour-advance policy', () => {
  const flat = selfPay.body.join(' ');
  assert.match(flat, /due at least 24 hours before the scheduled appointment/i);
});

test('3. the stale phrase is gone from its one known source file (a repo-wide search during diagnosis confirmed pricing.ts was the only occurrence anywhere in client/src)', () => {
  const text = readFileSync(join(root, 'src/data/pricing.ts'), 'utf8');
  const occurrences = (text.match(/due at the time services are provided/gi) || []).length;
  assert.equal(occurrences, 0);
});

test('4. the fee-variance sentence is preserved (not accidentally dropped alongside the timing fix)', () => {
  const flat = selfPay.body.join(' ');
  assert.match(flat, /Fees vary depending on the type and duration of the appointment/);
});

test('5. the new copy uses WE/OUR organizational voice, not first-person provider voice', () => {
  const flat = selfPay.body.join(' ');
  assert.doesNotMatch(flat, /\bI \b|\bmy\b|\bMy\b/);
});

test('6. no invented deposit/refund/payment-method/late-payment-penalty language was introduced', () => {
  const flat = selfPay.body.join(' ').toLowerCase();
  for (const forbidden of ['deposit', 'refund', 'credit card', 'debit card', 'late fee', 'late payment', 'penalty']) {
    assert.doesNotMatch(flat, new RegExp(forbidden, 'i'), `unexpected invented term: "${forbidden}"`);
  }
});

test('7. the short pricing-card sliding-scale statement (a separate string in FeesPageContent.tsx) is untouched by this change', () => {
  const text = readFileSync(join(root, 'src/components/sections/FeesPageContent.tsx'), 'utf8');
  assert.match(text, /Sliding Scale Available — Contact us to ask about eligibility and availability\./);
});

test('8. approved FL/MA/AZ psychiatric self-pay pricing is completely unaffected by this change', () => {
  const bySt = Object.fromEntries(psychiatricStatePricing.map((p) => [p.state, p]));
  assert.deepEqual(bySt.Florida, { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 300, followUpFee: 150 });
  assert.deepEqual(bySt.Massachusetts, { state: 'Massachusetts', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 300, followUpFee: 175 });
  assert.deepEqual(bySt.Arizona, { state: 'Arizona', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 325, followUpFee: 175 });
});

test('9. selfPay.body still has exactly two paragraphs (no unrelated structural change)', () => {
  assert.equal(selfPay.body.length, 2);
});
