/**
 * Regression tests for Phase 9 (Patient Journey & Conversion Upgrade).
 *
 * Two focused, safe changes, both confirmed by a prior read-only
 * investigation:
 *
 *   1. Removed a dead, contradictory 'Mental Health' pricing tier
 *      ($250/$150) from pricingTiers (data/pricing.ts) — it duplicated and
 *      contradicted the real psychiatric self-pay figure (Florida's
 *      approved initial fee is $300, not $250) and was already filtered
 *      out of rendering on /fees-insurance, but remained a landmine one
 *      refactor away from being displayed. The approved
 *      psychiatricStatePricing figures (the actual source of truth for
 *      FL/MA/AZ psychiatric self-pay) are untouched.
 *
 *   2. Added one small contextual link on /our-services ("Questions about
 *      cost or whether we serve your state? View Fees & Insurance"),
 *      mirroring the exact pattern already used on individual
 *      /services/[slug] pages — a plain, untracked navigation link, not a
 *      booking CTA.
 *
 * No PHI/clinical claims, no new booking CTA, no CMS mutation, no
 * analytics/tracking change.
 *
 *   npx tsx --test scripts/test-phase9-patient-journey.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pricingTiers, psychiatricStatePricing } from '../src/data/pricing.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');

/* ------------------------------------------------- pricing data integrity --- */

test('1. pricingTiers no longer contains a "Mental Health" entry (removed dead, contradictory data)', () => {
  assert.equal(
    pricingTiers.some((t) => t.name === 'Mental Health'),
    false
  );
});

test('2. pricingTiers retains exactly the two legitimate non-psychiatric self-pay tiers, figures unchanged', () => {
  assert.deepEqual(
    pricingTiers.map((t) => t.name),
    ['Primary Care', 'Weight Management']
  );
  const primaryCare = pricingTiers.find((t) => t.name === 'Primary Care');
  assert.equal(primaryCare.initialFee, 125);
  assert.equal(primaryCare.followUpFee, 75);
  const weightMgmt = pricingTiers.find((t) => t.name === 'Weight Management');
  assert.equal(weightMgmt.initialFee, 100);
  assert.equal(weightMgmt.followUpFee, 75);
});

test('3. no $250 figure remains anywhere in pricingTiers (the removed tier\'s exact contradictory value)', () => {
  for (const tier of pricingTiers) {
    assert.notEqual(tier.initialFee, 250);
  }
});

test('4. psychiatricStatePricing (the real FL/MA/AZ psychiatric self-pay source of truth) is completely unaffected', () => {
  const bySt = Object.fromEntries(psychiatricStatePricing.map((p) => [p.state, p]));
  assert.deepEqual(bySt.Florida, { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 300, followUpFee: 150 });
  assert.deepEqual(bySt.Massachusetts, { state: 'Massachusetts', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 300, followUpFee: 175 });
  assert.deepEqual(bySt.Arizona, { state: 'Arizona', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 325, followUpFee: 175 });
});

test('5. FeesPageContent no longer carries the now-unnecessary "Mental Health" filter (dead code removed alongside the data)', () => {
  const text = src('components/sections/FeesPageContent.tsx');
  assert.doesNotMatch(text, /filter\(\(tier\) => tier\.name !== 'Mental Health'\)/);
  assert.match(text, /\{pricingTiers\.map\(\(tier\) => \(/);
});

/* ------------------------------------------------- /our-services contextual link --- */

test('6. OurServicesPageContent links to /fees-insurance with the same contextual wording pattern used on service-detail pages', () => {
  const text = src('components/sections/OurServicesPageContent.tsx');
  assert.match(text, /href="\/fees-insurance"/);
  assert.match(text, /Questions about cost or whether we serve your state\?/);
  assert.match(text, /View Fees &amp; Insurance/);
});

test('7. the new /our-services link is a plain navigation link, not a booking CTA — no trackAs prop, no booking_click tracking added', () => {
  const text = src('components/sections/OurServicesPageContent.tsx');
  const linkBlockStart = text.indexOf('href="/fees-insurance"');
  const linkBlock = text.slice(Math.max(0, linkBlockStart - 200), linkBlockStart + 200);
  assert.doesNotMatch(linkBlock, /trackAs/);
  assert.doesNotMatch(linkBlock, /booking_click/);
  // The file's only trackAs="booking_click" remains the pre-existing closing JourneyCta (count unchanged — see test-booking-click-tracking.mjs test 4).
  const trackingCount = (text.match(/trackAs="booking_click"/g) || []).length;
  assert.equal(trackingCount, 1);
});

test('8. the new copy uses WE/OUR organizational voice, not first-person provider voice', () => {
  const text = src('components/sections/OurServicesPageContent.tsx');
  const newLineStart = text.indexOf('Questions about cost');
  const newLineBlock = text.slice(newLineStart, newLineStart + 200);
  assert.doesNotMatch(newLineBlock, /\bI \b|\bmy\b|\bMy\b/);
});

test('9. no PHI/clinical-detail language was introduced in either changed component', () => {
  for (const file of ['components/sections/OurServicesPageContent.tsx', 'components/sections/FeesPageContent.tsx']) {
    const text = src(file);
    for (const forbidden of [/diagnosis/i, /symptom/i, /date of birth/i, /\bDOB\b/, /member id/i, /medical history/i]) {
      assert.doesNotMatch(text, forbidden, `unexpected clinical/PHI term in ${file}`);
    }
  }
});

test('10. no unsupported "individual therapy"/"couples therapy" claim exists in either changed component', () => {
  for (const file of ['components/sections/OurServicesPageContent.tsx', 'components/sections/FeesPageContent.tsx']) {
    const text = src(file);
    assert.doesNotMatch(text, /individual therapy|couples therapy|psychotherapy session/i);
  }
});
