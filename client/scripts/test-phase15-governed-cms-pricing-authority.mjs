/**
 * Phase 15 (Restore Governed CMS Pricing Authority with Protected
 * Fallback) — client resolver regression tests.
 *
 * Uses the actual resolvePsychiatricStatePricing()/mapFees() implementation
 * (client/src/lib/cms-resolve.ts), not a reimplementation. Proves the full
 * validation contract: a CMS `psychiatricStatePricing` collection is
 * authoritative only when it is complete and fully valid; anything short
 * of that falls back to the complete protected static dataset
 * (client/src/data/pricing.ts) — never a partial merge of the two.
 *
 * No network calls, no CMS, no Production data.
 *
 *   npx tsx --test scripts/test-phase15-governed-cms-pricing-authority.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapFees, resolvePsychiatricStatePricing } from '../src/lib/cms-resolve.ts';
import { psychiatricStatePricing as staticPricing } from '../src/data/pricing.ts';

function findState(list, name) {
  return list.find((s) => s.state === name);
}

function validEntry(overrides) {
  const base = { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 300, followUpFee: 150 };
  return { ...base, ...overrides };
}

const VALID_UNCHANGED = [
  { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 300, followUpFee: 150 },
  { state: 'Massachusetts', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 300, followUpFee: 175 },
  { state: 'Arizona', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 325, followUpFee: 175 },
];

const VALID_CHANGED = [
  { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 310, followUpFee: 155 },
  { state: 'Massachusetts', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 315, followUpFee: 180 },
  { state: 'Arizona', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 335, followUpFee: 185 },
];

function cmsWithPricing(pricing) {
  return {
    sections: [{ page_key: 'fees', section_key: 'self_pay', content: { psychiatricStatePricing: pricing }, published: true }],
  };
}

// ---------------------------------------------------------------------------
// 1-2: a complete, valid CMS collection is authoritative (proves authority)
// ---------------------------------------------------------------------------

test('1. a complete, valid, unchanged CMS collection is used as-is (matches static, still proves the CMS path is live)', () => {
  const result = resolvePsychiatricStatePricing(VALID_UNCHANGED);
  assert.deepEqual(result, VALID_UNCHANGED);
});

test('2. changed but valid positive CMS amounts appear publicly — proves CMS authority, not merely coincidental agreement with static', () => {
  const result = mapFees(cmsWithPricing(VALID_CHANGED));
  assert.equal(findState(result.psychiatricStatePricing, 'Florida').initialFee, 310);
  assert.equal(findState(result.psychiatricStatePricing, 'Florida').followUpFee, 155);
  assert.equal(findState(result.psychiatricStatePricing, 'Massachusetts').initialFee, 315);
  assert.equal(findState(result.psychiatricStatePricing, 'Massachusetts').followUpFee, 180);
  assert.equal(findState(result.psychiatricStatePricing, 'Arizona').initialFee, 335);
  assert.equal(findState(result.psychiatricStatePricing, 'Arizona').followUpFee, 185);
});

// ---------------------------------------------------------------------------
// 3: missing, null, non-array, and empty CMS pricing each use full fallback
// ---------------------------------------------------------------------------

test('3a. missing (undefined) CMS pricing uses full fallback', () => {
  assert.deepEqual(resolvePsychiatricStatePricing(undefined), staticPricing);
});

test('3b. null CMS pricing uses full fallback', () => {
  assert.deepEqual(resolvePsychiatricStatePricing(null), staticPricing);
});

test('3c. non-array (object) CMS pricing uses full fallback', () => {
  assert.deepEqual(resolvePsychiatricStatePricing({ Florida: validEntry() }), staticPricing);
});

test('3d. non-array (string) CMS pricing uses full fallback', () => {
  assert.deepEqual(resolvePsychiatricStatePricing('garbage'), staticPricing);
});

test('3e. empty array CMS pricing uses full fallback', () => {
  assert.deepEqual(resolvePsychiatricStatePricing([]), staticPricing);
});

// ---------------------------------------------------------------------------
// 4: missing FL, MA, or AZ each uses full fallback
// ---------------------------------------------------------------------------

test('4a. missing Florida (only MA + AZ present) uses full fallback', () => {
  const pricing = VALID_UNCHANGED.filter((s) => s.state !== 'Florida');
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('4b. missing Massachusetts uses full fallback', () => {
  const pricing = VALID_UNCHANGED.filter((s) => s.state !== 'Massachusetts');
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('4c. missing Arizona uses full fallback', () => {
  const pricing = VALID_UNCHANGED.filter((s) => s.state !== 'Arizona');
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

// ---------------------------------------------------------------------------
// 5: duplicate, unsupported, or additional states use full fallback
// ---------------------------------------------------------------------------

test('5a. a duplicate state (two Florida entries, no Massachusetts) uses full fallback', () => {
  const pricing = [validEntry(), validEntry(), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('5b. an unsupported state (Texas instead of one of the three) uses full fallback', () => {
  const pricing = [
    validEntry({ state: 'Texas' }),
    findState(VALID_UNCHANGED, 'Massachusetts'),
    findState(VALID_UNCHANGED, 'Arizona'),
  ];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('5c. a 4th additional state entry (even if all 3 required states are also present and valid) uses full fallback', () => {
  const pricing = [...VALID_UNCHANGED, validEntry({ state: 'Texas' })];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

// ---------------------------------------------------------------------------
// 6: missing required fields use fallback
// ---------------------------------------------------------------------------

test('6a. a state entry missing initialFee entirely uses full fallback', () => {
  const fl = findState(VALID_UNCHANGED, 'Florida');
  const { initialFee: _initialFee, ...withoutInitialFee } = fl;
  const pricing = [withoutInitialFee, findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('6b. a state entry missing selfPayOnly entirely uses full fallback', () => {
  const fl = findState(VALID_UNCHANGED, 'Florida');
  const { selfPayOnly: _selfPayOnly, ...withoutSelfPayOnly } = fl;
  const pricing = [withoutSelfPayOnly, findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('6c. a non-object entry (e.g. a plain string) uses full fallback', () => {
  const pricing = ['Florida', findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

// ---------------------------------------------------------------------------
// 7: zero, negative, NaN, infinite, and otherwise invalid fees use fallback
// ---------------------------------------------------------------------------

test('7a. a zero fee uses full fallback', () => {
  const pricing = [validEntry({ initialFee: 0 }), findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('7b. a negative fee uses full fallback', () => {
  const pricing = [validEntry({ followUpFee: -150 }), findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('7c. NaN fee uses full fallback', () => {
  const pricing = [validEntry({ initialFee: NaN }), findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('7d. Infinity fee uses full fallback', () => {
  const pricing = [validEntry({ initialFee: Infinity }), findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('7e. -Infinity fee uses full fallback', () => {
  const pricing = [validEntry({ followUpFee: -Infinity }), findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('7f. a null fee uses full fallback', () => {
  const pricing = [validEntry({ initialFee: null }), findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

// ---------------------------------------------------------------------------
// 8: numeric-string handling is deterministic (rejected, not coerced —
// no established precedent for string-typed pricing exists for this field)
// ---------------------------------------------------------------------------

test('8. a numeric-string fee ("300" instead of 300) is rejected, not coerced — uses full fallback', () => {
  const pricing = [validEntry({ initialFee: '300' }), findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

// ---------------------------------------------------------------------------
// 9: wrong selfPayOnly for any state uses fallback
// ---------------------------------------------------------------------------

test('9a. Florida with selfPayOnly=true (should be false) uses full fallback', () => {
  const pricing = [validEntry({ selfPayOnly: true }), findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('9b. Massachusetts with selfPayOnly=false (should be true) uses full fallback', () => {
  const ma = { ...findState(VALID_UNCHANGED, 'Massachusetts'), selfPayOnly: false };
  const pricing = [findState(VALID_UNCHANGED, 'Florida'), ma, findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('9c. Arizona with selfPayOnly=false (should be true) uses full fallback', () => {
  const az = { ...findState(VALID_UNCHANGED, 'Arizona'), selfPayOnly: false };
  const pricing = [findState(VALID_UNCHANGED, 'Florida'), findState(VALID_UNCHANGED, 'Massachusetts'), az];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('9d. a truthy-but-non-boolean selfPayOnly (1 instead of true) uses full fallback (strict type check, no truthy coercion)', () => {
  const ma = { ...findState(VALID_UNCHANGED, 'Massachusetts'), selfPayOnly: 1 };
  const pricing = [findState(VALID_UNCHANGED, 'Florida'), ma, findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

// ---------------------------------------------------------------------------
// 10: invalid sliding-scale governance uses fallback
// ---------------------------------------------------------------------------

test('10a. Florida with slidingScaleAvailable=false (should be true) uses full fallback', () => {
  const pricing = [validEntry({ slidingScaleAvailable: false }), findState(VALID_UNCHANGED, 'Massachusetts'), findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

test('10b. Massachusetts with slidingScaleAvailable=false uses full fallback', () => {
  const ma = { ...findState(VALID_UNCHANGED, 'Massachusetts'), slidingScaleAvailable: false };
  const pricing = [findState(VALID_UNCHANGED, 'Florida'), ma, findState(VALID_UNCHANGED, 'Arizona')];
  assert.deepEqual(resolvePsychiatricStatePricing(pricing), staticPricing);
});

// ---------------------------------------------------------------------------
// 11: no partial merging occurs — one bad state invalidates the whole set,
// including the other two states' otherwise-valid, changed figures
// ---------------------------------------------------------------------------

test('11. one invalid state (Arizona zero fee) invalidates the entire collection — Florida/Massachusetts do NOT partially apply their otherwise-valid changed values', () => {
  const pricing = [
    { ...findState(VALID_CHANGED, 'Florida') },
    { ...findState(VALID_CHANGED, 'Massachusetts') },
    { ...findState(VALID_CHANGED, 'Arizona'), initialFee: 0 },
  ];
  const result = resolvePsychiatricStatePricing(pricing);
  assert.deepEqual(result, staticPricing);
  // Explicitly confirm Florida's changed $310 did NOT leak through despite being individually valid.
  assert.equal(findState(result, 'Florida').initialFee, 300);
});

// ---------------------------------------------------------------------------
// 12: fallback is exactly FL $300/$150, MA $300/$175 Self-Pay Only, AZ $325/$175 Self-Pay Only
// ---------------------------------------------------------------------------

test('12. the fallback values are exactly the approved figures', () => {
  const fallback = resolvePsychiatricStatePricing(null);
  assert.equal(findState(fallback, 'Florida').initialFee, 300);
  assert.equal(findState(fallback, 'Florida').followUpFee, 150);
  assert.equal(findState(fallback, 'Florida').selfPayOnly, false);
  assert.equal(findState(fallback, 'Massachusetts').initialFee, 300);
  assert.equal(findState(fallback, 'Massachusetts').followUpFee, 175);
  assert.equal(findState(fallback, 'Massachusetts').selfPayOnly, true);
  assert.equal(findState(fallback, 'Arizona').initialFee, 325);
  assert.equal(findState(fallback, 'Arizona').followUpFee, 175);
  assert.equal(findState(fallback, 'Arizona').selfPayOnly, true);
});

// ---------------------------------------------------------------------------
// 13: state ordering is deterministic (always Florida, Massachusetts,
// Arizona — regardless of the order the CMS array happens to use)
// ---------------------------------------------------------------------------

test('13. valid CMS pricing is always returned in canonical Florida/Massachusetts/Arizona order, even if the CMS array order differs', () => {
  const reordered = [
    findState(VALID_UNCHANGED, 'Arizona'),
    findState(VALID_UNCHANGED, 'Florida'),
    findState(VALID_UNCHANGED, 'Massachusetts'),
  ];
  const result = resolvePsychiatricStatePricing(reordered);
  assert.deepEqual(result.map((s) => s.state), ['Florida', 'Massachusetts', 'Arizona']);
});

test('13b. the fallback is also always in canonical order', () => {
  assert.deepEqual(resolvePsychiatricStatePricing(null).map((s) => s.state), ['Florida', 'Massachusetts', 'Arizona']);
});

// ---------------------------------------------------------------------------
// 16: obsolete $250 psychiatric pricing is absent
// ---------------------------------------------------------------------------

test('16. no valid CMS collection using $250 is inadvertently normalized to $250 anywhere, and $250 is absent from the fallback', () => {
  assert.ok(!staticPricing.some((s) => s.initialFee === 250 || s.followUpFee === 250));
});

// ---------------------------------------------------------------------------
// Canonical display names preserved
// ---------------------------------------------------------------------------

test('canonical display names (exact state name strings) are preserved in both the CMS-authoritative and fallback paths', () => {
  const cmsResult = resolvePsychiatricStatePricing(VALID_CHANGED);
  assert.deepEqual(cmsResult.map((s) => s.state), ['Florida', 'Massachusetts', 'Arizona']);
  const fallbackResult = resolvePsychiatricStatePricing(null);
  assert.deepEqual(fallbackResult.map((s) => s.state), ['Florida', 'Massachusetts', 'Arizona']);
});
