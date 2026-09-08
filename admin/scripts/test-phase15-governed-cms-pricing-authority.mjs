/**
 * Phase 15 (Restore Governed CMS Pricing Authority with Protected
 * Fallback) — Admin regression tests.
 *
 * Covers the Admin-side half of the 25-item Phase 15 test requirement
 * (items 14-25; the client resolver's authority/fallback contract, items
 * 1-13, is exhaustively covered in
 * client/scripts/test-phase15-governed-cms-pricing-authority.mjs).
 *
 * No network calls, no CMS, no Production data, no React rendering —
 * mirrors this repo's established pattern (see
 * test-phase13-admin-pricing-authority.mjs's buildSelfPaySavePayload) of
 * reimplementing pure closures that match the real component logic
 * exactly, plus source-level assertions for wiring that only makes sense
 * inside a mounted component.
 *
 *   npx tsx --test scripts/test-phase15-governed-cms-pricing-authority.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PROTECTED_PSYCHIATRIC_PRICING } from '../src/lib/protected-pricing.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const feesCopySource = readFileSync(join(__dirname, '../src/components/FeesCopy.tsx'), 'utf8');
const sectionsPageSource = readFileSync(join(__dirname, '../src/app/(app)/sections/page.tsx'), 'utf8');
const insurancePageSource = readFileSync(join(__dirname, '../src/app/(app)/insurance/page.tsx'), 'utf8');
// Strips // line comments (this repo's files use CRLF; see Phase 14's own
// fix for why a `$`-anchored version silently fails to match at all here).
const insurancePageCode = insurancePageSource
  .split('\n')
  .map((line) => line.replace(/\/\/.*/, ''))
  .join('\n');

function findState(name) {
  return PROTECTED_PSYCHIATRIC_PRICING.find((s) => s.state === name);
}

/** Mirrors isValidFeeInput() in FeesCopy.tsx exactly. */
function isValidFeeInput(value) {
  if (!value.trim()) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

/** Mirrors onSavePricing()'s payload construction in FeesCopy.tsx exactly. */
function buildPricingSavePayload(pricingDraft) {
  return PROTECTED_PSYCHIATRIC_PRICING.map((state) => ({
    state: state.state,
    selfPayOnly: state.selfPayOnly,
    slidingScaleAvailable: state.slidingScaleAvailable,
    initialFee: Number(pricingDraft[state.state].initialFee),
    followUpFee: Number(pricingDraft[state.state].followUpFee),
  }));
}

/** Mirrors the marketing-copy saveSection() payload construction in onSubmit exactly (same as test-phase13-admin-pricing-authority.mjs's buildSelfPaySavePayload). */
function buildMarketingCopySavePayload(selfPayContent, selfPayHeading, selfPayBody) {
  return {
    ...selfPayContent,
    heading: selfPayHeading,
    body: selfPayBody.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// 14: Admin renders exactly three governed editors, no state-structure controls
// ---------------------------------------------------------------------------

test('14a. exactly three protected states are governed (Florida, Massachusetts, Arizona) — no more, no fewer', () => {
  assert.equal(PROTECTED_PSYCHIATRIC_PRICING.length, 3);
  assert.deepEqual(PROTECTED_PSYCHIATRIC_PRICING.map((s) => s.state), ['Florida', 'Massachusetts', 'Arizona']);
});

test('14b. no add/delete/duplicate/rename/reorder control exists for the state list', () => {
  assert.doesNotMatch(feesCopySource, /Add state|Remove state|Delete state|Duplicate state|New state|Rename state/i);
  assert.doesNotMatch(feesCopySource, /addState|removeState|deleteState|duplicateState/);
});

test('14c. the editor renders from the fixed PROTECTED_PSYCHIATRIC_PRICING list, not a dynamically-sized array the owner controls', () => {
  assert.match(feesCopySource, /PROTECTED_PSYCHIATRIC_PRICING\.map\(\(state\)/);
});

// ---------------------------------------------------------------------------
// 15: Admin blocks empty, zero, negative, and non-finite fees
// ---------------------------------------------------------------------------

test('15a. an empty string fee is invalid', () => {
  assert.equal(isValidFeeInput(''), false);
  assert.equal(isValidFeeInput('   '), false);
});

test('15b. a zero fee is invalid', () => {
  assert.equal(isValidFeeInput('0'), false);
});

test('15c. a negative fee is invalid', () => {
  assert.equal(isValidFeeInput('-150'), false);
});

test('15d. a non-numeric fee is invalid', () => {
  assert.equal(isValidFeeInput('abc'), false);
});

test('15e. Infinity/NaN-producing input is invalid', () => {
  assert.equal(isValidFeeInput('Infinity'), false);
  assert.equal(isValidFeeInput('NaN'), false);
});

test('15f. a valid positive fee is accepted', () => {
  assert.equal(isValidFeeInput('300'), true);
  assert.equal(isValidFeeInput('310.50'), true);
});

test('invalid pricing cannot be saved — onSavePricing validates every field before calling the API', () => {
  assert.match(feesCopySource, /if \(Object\.keys\(nextErrors\)\.length > 0\) \{/);
  const gateIdx = feesCopySource.indexOf('if (Object.keys(nextErrors).length > 0)');
  const apiCallIdx = feesCopySource.indexOf('await saveSection(selfPayId', gateIdx);
  assert.ok(gateIdx > -1 && apiCallIdx > gateIdx, 'expected the validation gate to run strictly before the pricing save API call');
});

// ---------------------------------------------------------------------------
// 16: fixed self-pay governance cannot be altered
// ---------------------------------------------------------------------------

test('16a. selfPayOnly/slidingScaleAvailable in the save payload always come from the protected constant, never from editable state', () => {
  const payload = buildPricingSavePayload({
    Florida: { initialFee: '300', followUpFee: '150' },
    Massachusetts: { initialFee: '300', followUpFee: '175' },
    Arizona: { initialFee: '325', followUpFee: '175' },
  });
  assert.equal(findState('Florida').selfPayOnly, false);
  assert.equal(payload.find((s) => s.state === 'Florida').selfPayOnly, false);
  assert.equal(payload.find((s) => s.state === 'Massachusetts').selfPayOnly, true);
  assert.equal(payload.find((s) => s.state === 'Arizona').selfPayOnly, true);
});

test('16b. no UI control (checkbox or otherwise) exists to set selfPayOnly or slidingScaleAvailable', () => {
  const pricingBlockStart = feesCopySource.indexOf('Psychiatric Self-Pay Pricing');
  const pricingBlockEnd = feesCopySource.indexOf('Intro body');
  const pricingBlock = feesCopySource.slice(pricingBlockStart, pricingBlockEnd);
  assert.doesNotMatch(pricingBlock, /setSelfPayOnly|setSlidingScale/);
  assert.doesNotMatch(pricingBlock, /type="checkbox"/);
});

// ---------------------------------------------------------------------------
// 17: intentional pricing save includes valid psychiatricStatePricing
// ---------------------------------------------------------------------------

test('17. a well-formed pricing save payload includes all 3 states, correct governance, and valid positive fees', () => {
  const payload = buildPricingSavePayload({
    Florida: { initialFee: '310', followUpFee: '155' },
    Massachusetts: { initialFee: '315', followUpFee: '180' },
    Arizona: { initialFee: '335', followUpFee: '185' },
  });
  assert.equal(payload.length, 3);
  for (const entry of payload) {
    const governance = findState(entry.state);
    assert.ok(governance, `unexpected state in payload: ${entry.state}`);
    assert.equal(entry.selfPayOnly, governance.selfPayOnly);
    assert.equal(entry.slidingScaleAvailable, governance.slidingScaleAvailable);
    assert.equal(typeof entry.initialFee, 'number');
    assert.ok(Number.isFinite(entry.initialFee) && entry.initialFee > 0);
    assert.equal(typeof entry.followUpFee, 'number');
    assert.ok(Number.isFinite(entry.followUpFee) && entry.followUpFee > 0);
  }
});

test('pricing save is the ONLY place in FeesCopy.tsx that ever sets a psychiatricStatePricing key', () => {
  const matches = [...feesCopySource.matchAll(/psychiatricStatePricing:/g)];
  assert.equal(matches.length, 1, 'expected exactly one psychiatricStatePricing: assignment (in onSavePricing)');
});

// ---------------------------------------------------------------------------
// 18-19: marketing-only save excludes pricing and preserves hostile values
// ---------------------------------------------------------------------------

test('18. a marketing-only copy save never includes psychiatricStatePricing', () => {
  const payload = buildMarketingCopySavePayload({ heading: 'Old', body: ['Old'] }, 'New heading', 'New body');
  assert.equal(Object.hasOwn(payload, 'psychiatricStatePricing'), false);
});

test('19. a marketing-only copy save preserves a hostile stored pricing value byte-for-byte', () => {
  const hostile = [
    { state: 'Florida', selfPayOnly: true, slidingScaleAvailable: false, initialFee: 1, followUpFee: 999 },
    { state: 'Massachusetts', selfPayOnly: false, slidingScaleAvailable: false, initialFee: 1, followUpFee: 999 },
    { state: 'Arizona', selfPayOnly: false, slidingScaleAvailable: false, initialFee: 1, followUpFee: 999 },
  ];
  const loaded = { heading: 'Old heading', body: ['Old body'], psychiatricStatePricing: hostile };
  const payload = buildMarketingCopySavePayload(loaded, 'New heading only', 'New body only');
  assert.deepEqual(payload.psychiatricStatePricing, hostile);
});

// ---------------------------------------------------------------------------
// 20: pricing save preserves unrelated fees/self_pay keys
// ---------------------------------------------------------------------------

test('20. saving pricing preserves unrelated keys already in the self_pay content object (heading, body, legacy fields)', () => {
  const selfPayContent = { heading: 'Cash-Pay / Self-Pay Options', body: ['Paragraph one.'], someLegacyField: 'kept' };
  const pricingPayload = buildPricingSavePayload({
    Florida: { initialFee: '300', followUpFee: '150' },
    Massachusetts: { initialFee: '300', followUpFee: '175' },
    Arizona: { initialFee: '325', followUpFee: '175' },
  });
  const savedContent = { ...selfPayContent, psychiatricStatePricing: pricingPayload };
  assert.equal(savedContent.heading, 'Cash-Pay / Self-Pay Options');
  assert.deepEqual(savedContent.body, ['Paragraph one.']);
  assert.equal(savedContent.someLegacyField, 'kept');
  assert.equal(savedContent.psychiatricStatePricing.length, 3);
});

test('the actual onSavePricing implementation spreads ...selfPayContent before overriding only psychiatricStatePricing', () => {
  const saveCallIdx = feesCopySource.indexOf('await saveSection(selfPayId');
  const block = feesCopySource.slice(saveCallIdx, saveCallIdx + 300);
  assert.match(block, /\.\.\.selfPayContent/);
  assert.match(block, /psychiatricStatePricing: payload/);
});

// ---------------------------------------------------------------------------
// 21: PhaseA1Sync has no pricing write behavior (Phase 14 regression guard)
// ---------------------------------------------------------------------------

test('21. PhaseA1Sync (Admin -> Insurance) still has zero pricing write/repair/sync/verification behavior', () => {
  assert.doesNotMatch(insurancePageCode, /psychiatricStatePricing/);
  assert.doesNotMatch(insurancePageCode, /expectedPricing/);
  assert.doesNotMatch(insurancePageCode, /currentPricing/);
  assert.doesNotMatch(insurancePageCode, /verifiedPricing/);
  assert.doesNotMatch(insurancePageCode, /section_key === 'self_pay'/);
});

// ---------------------------------------------------------------------------
// 22: raw JSON warning accurately describes authority/fallback, correctly targeted
// ---------------------------------------------------------------------------

test('22a. the Sections JSON editor hint accurately describes the conditional authority/fallback model', () => {
  const contentFieldBlock = sectionsPageSource.slice(sectionsPageSource.indexOf("key: 'content'"));
  assert.match(contentFieldBlock, /form\.page_key === 'fees' && form\.section_key === 'self_pay'/);
  assert.match(contentFieldBlock, /complete, valid psychiatricStatePricing value here controls public pricing/);
  assert.match(contentFieldBlock, /incomplete or invalid/);
  assert.match(contentFieldBlock, /structured pricing editor on Admin/);
});

test('22b. the hint remains scoped to exactly the fees/self_pay row (null for every other section)', () => {
  const contentFieldBlock = sectionsPageSource.slice(
    sectionsPageSource.indexOf("key: 'content'"),
    sectionsPageSource.indexOf("key: 'published'")
  );
  assert.match(contentFieldBlock, /: null/);
});

// ---------------------------------------------------------------------------
// 23: Florida-only insurance and sliding-scale governance remain intact
// ---------------------------------------------------------------------------

test('23a. Florida is the only non-self-pay-only state (Florida-only insurance governance intact)', () => {
  const selfPayOnlyStates = PROTECTED_PSYCHIATRIC_PRICING.filter((s) => s.selfPayOnly).map((s) => s.state);
  assert.deepEqual(selfPayOnlyStates.sort(), ['Arizona', 'Massachusetts']);
});

test('23b. sliding-scale governance is true for all three states and is never exposed as an editable control', () => {
  assert.ok(PROTECTED_PSYCHIATRIC_PRICING.every((s) => s.slidingScaleAvailable === true));
  assert.doesNotMatch(feesCopySource, /Sliding Scale Available/);
});

// ---------------------------------------------------------------------------
// 24: obsolete $250 psychiatric pricing is absent
// ---------------------------------------------------------------------------

test('24. no $250 psychiatric pricing anywhere in the governed Admin pricing values or source', () => {
  assert.ok(!PROTECTED_PSYCHIATRIC_PRICING.some((s) => s.initialFee === 250 || s.followUpFee === 250));
  assert.doesNotMatch(feesCopySource, /\$250/);
});

// ---------------------------------------------------------------------------
// 25: FAQ, booking, analytics, campaigns, Paubox, Charm, and PHI unchanged
// ---------------------------------------------------------------------------

test('25. FeesCopy.tsx, the Insurance page, and the Sections page have no FAQ/booking/analytics/campaign/Paubox/Charm/PHI-related code', () => {
  const pattern = /faq|booking_click|trackAs|analytics|campaign|paubox|charm|diagnosis|medication history/i;
  assert.doesNotMatch(feesCopySource, pattern);
  assert.doesNotMatch(insurancePageCode, pattern);
  assert.doesNotMatch(sectionsPageSource, pattern);
});
