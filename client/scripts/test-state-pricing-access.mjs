/**
 * Regression tests for P7-2: Massachusetts/Arizona self-pay pricing access
 * on their own telehealth state pages.
 *
 * Context: a live, published CMS row already exists for all three states
 * (confirmed via the public API) whose single `self_pay_fee` column is
 * null — mapTelehealthStates() would silently override any value put in
 * the legacy `selfPayFee` field of this static file. selfPayInitialFee /
 * selfPayFollowUpFee / pricingCta are therefore new fields deliberately
 * NOT wired into that CMS mapping (same precedent as inPersonAvailable),
 * so this file is guaranteed to be the source of truth for them in
 * Production regardless of CMS state.
 *
 * No network calls, no CMS, no production data.
 *
 *   npx tsx --test scripts/test-state-pricing-access.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { telehealthStates, getTelehealthState } from '../src/data/telehealth-states.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(
  join(__dirname, '../src/components/sections/TelehealthStatePageContent.tsx'),
  'utf8'
);
const cmsResolveSource = readFileSync(join(__dirname, '../src/lib/cms-resolve.ts'), 'utf8');

const ma = getTelehealthState('massachusetts');
const az = getTelehealthState('arizona');
const fl = getTelehealthState('florida');

/* ---------------------------------------------------------- 1, 2. pricing --- */

test('1. Massachusetts approved pricing: $300 initial, $175 follow-up', () => {
  assert.equal(ma.selfPayInitialFee, 300);
  assert.equal(ma.selfPayFollowUpFee, 175);
});

test('2. Arizona approved pricing: $325 initial, $175 follow-up', () => {
  assert.equal(az.selfPayInitialFee, 325);
  assert.equal(az.selfPayFollowUpFee, 175);
});

/* ------------------------------------------------------- 3, 4. self-pay --- */

test('3. Massachusetts and Arizona remain explicitly self-pay only', () => {
  for (const state of [ma, az]) {
    assert.equal(state.insuranceMode, 'self_pay_only');
    assert.equal(state.selfPayEnabled, true);
  }
});

test('4. MA/AZ do not gain a Florida-style "insuranceMode: existing" branch or insurance claim', () => {
  assert.notEqual(ma.insuranceMode, 'existing');
  assert.notEqual(az.insuranceMode, 'existing');
  // The component's "Questions about cost? {secondaryCta}." insurance-participation
  // phrasing must only ever render for insuranceMode === 'existing' (Florida).
  const flatComponent = componentSource.replace(/\s+/g, ' ');
  assert.match(flatComponent, /insuranceMode === 'existing' \? \(/);
});

/* --------------------------------------------------------- 5. fees link --- */

test('5. MA/AZ state pages expose a route to /fees-insurance', () => {
  assert.deepEqual(ma.pricingCta, { label: 'View Fees & Insurance', href: '/fees-insurance' });
  assert.deepEqual(az.pricingCta, { label: 'View Fees & Insurance', href: '/fees-insurance' });
});

/* -------------------------------------------------- 6, 7. CTAs preserved --- */

test('6. "Meet Your Provider" remains available for MA/AZ, unchanged', () => {
  assert.deepEqual(ma.secondaryCta, { label: 'Meet Your Provider', href: '/bio' });
  assert.deepEqual(az.secondaryCta, { label: 'Meet Your Provider', href: '/bio' });
});

test('7. "Book an Appointment" remains available for all three states, unchanged', () => {
  for (const state of telehealthStates) {
    assert.equal(state.primaryCta.label, 'Book an Appointment');
    assert.equal(state.primaryCta.href, '/book-telehealth-mental-health-appointment#charm-calendar');
  }
});

test('6b. the component renders pricingCta and secondaryCta together, not one replacing the other', () => {
  assert.match(componentSource, /state\.pricingCta && \(/);
  assert.match(componentSource, /href=\{state\.pricingCta\.href\}/);
  assert.match(componentSource, /\{state\.pricingCta\.label\}/);
  assert.match(componentSource, /href=\{state\.secondaryCta\.href\}/);
  assert.match(componentSource, /\{state\.secondaryCta\.label\}/);
  // Confirm both Links live inside the same self-pay-only ternary branch, not
  // two separate mutually-exclusive branches.
  const ternaryStart = componentSource.indexOf("state.insuranceMode === 'existing' ? (");
  const selfPayBranchStart = componentSource.indexOf(') : (', ternaryStart);
  const sectionEnd = componentSource.indexOf('</div>\n        </div>\n      </section>', selfPayBranchStart);
  const selfPayBranch = componentSource.slice(selfPayBranchStart, sectionEnd);
  const linkCount = (selfPayBranch.match(/<Link/g) || []).length;
  assert.equal(linkCount, 2, `expected exactly 2 <Link> elements (pricingCta + secondaryCta) in the self-pay branch, found ${linkCount}`);
});

/* --------------------------------------------------- 8. P7-1 preserved --- */

test('8. P7-1 booking_click instrumentation remains present and is not duplicated', () => {
  const matches = componentSource.match(/trackAs="booking_click"/g) || [];
  assert.equal(matches.length, 1, 'expected exactly one trackAs="booking_click" (the primary SwapButton)');
  assert.doesNotMatch(componentSource, /pricingCta[\s\S]{0,120}trackAs/, 'the pricing link must not be tracked as booking_click');
  assert.doesNotMatch(componentSource, /secondaryCta\.label[\s\S]{0,40}trackAs/, 'the provider link must not be tracked as booking_click');
});

/* ----------------------------------------------- 9. no office implication --- */

test('9. no Massachusetts or Arizona physical-office implication is introduced', () => {
  for (const state of [ma, az]) {
    assert.doesNotMatch(state.careMode, /office/i);
  }
  // The existing explicit "no office" subheading and FAQ answer must be untouched.
  assert.match(ma.subheading, /no physical office in Massachusetts/i);
  assert.match(az.subheading, /no physical office in Arizona/i);
  const officeFaqMa = ma.faqs.find((f) => /office in massachusetts/i.test(f.question));
  const officeFaqAz = az.faqs.find((f) => /office in arizona/i.test(f.question));
  assert.match(officeFaqMa.answer, /Our only physical office is in Orlando, Florida/);
  assert.match(officeFaqAz.answer, /Our only physical office is in Orlando, Florida/);
});

/* ------------------------------------------------- 10. Florida unchanged --- */

test('10. Florida pricing/state fields are unchanged by this implementation', () => {
  assert.equal(fl.insuranceMode, 'existing');
  assert.equal(fl.selfPayEnabled, false);
  assert.equal(fl.selfPayInitialFee, null);
  assert.equal(fl.selfPayFollowUpFee, null);
  assert.equal(fl.pricingCta, null);
  assert.deepEqual(fl.secondaryCta, { label: 'View Fees & Insurance', href: '/fees-insurance' });
});

test('10b. Florida approved psychiatric self-pay pricing on /fees-insurance is unaffected (data/pricing.ts untouched by this change)', async () => {
  const { psychiatricStatePricing } = await import('../src/data/pricing.ts');
  const flPricing = psychiatricStatePricing.find((p) => p.state === 'Florida');
  assert.ok(flPricing, 'expected a Florida entry in psychiatricStatePricing');
  assert.equal(flPricing.initialFee, 300);
  assert.equal(flPricing.followUpFee, 150);
});

test('10c. Fees & Insurance page pricing source (data/pricing.ts) already matches the exact MA/AZ figures used on the state pages', async () => {
  const { psychiatricStatePricing } = await import('../src/data/pricing.ts');
  const maPricing = psychiatricStatePricing.find((p) => p.state === 'Massachusetts');
  const azPricing = psychiatricStatePricing.find((p) => p.state === 'Arizona');
  assert.equal(maPricing.initialFee, ma.selfPayInitialFee);
  assert.equal(maPricing.followUpFee, ma.selfPayFollowUpFee);
  assert.equal(azPricing.initialFee, az.selfPayInitialFee);
  assert.equal(azPricing.followUpFee, az.selfPayFollowUpFee);
});

/* --------------------------------------------- 11. no therapy terminology --- */

test('11. no "therapy session"/"therapy visit"/"counseling session" terminology was introduced', () => {
  const newText = [
    'Self-Pay Only',
    'Initial psychiatric evaluation',
    'Follow-up medication management',
    'View Fees & Insurance',
  ].join(' ');
  assert.doesNotMatch(newText, /therapy session|therapy visit|counseling session/i);
  assert.doesNotMatch(componentSource, /therapy session|therapy visit|counseling session/i);
});

/* --------------------------------------------------------- CMS isolation --- */

test('12. the new fields are not read from any CMS row (guaranteed Production source-of-truth)', () => {
  // mapTelehealthStates()'s returned object must not reference these three
  // keys from `row` — if it did, the live published CMS rows (self_pay_fee
  // already null there) would silently override the approved figures.
  const fnStart = cmsResolveSource.indexOf('function mapTelehealthStates');
  const fnEnd = cmsResolveSource.indexOf('\n}', fnStart);
  const fn = cmsResolveSource.slice(fnStart, fnEnd);
  assert.doesNotMatch(fn, /selfPayInitialFee/);
  assert.doesNotMatch(fn, /selfPayFollowUpFee/);
  assert.doesNotMatch(fn, /pricingCta/);
});
