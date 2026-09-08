/**
 * Regression tests for mapInsurance() (client/src/lib/cms-resolve.ts).
 *
 * Root cause of a blank Accepted-Insurance carousel on malformed CMS data:
 * `live` (whether the overall CMS fetch succeeded at all) previously gated
 * the static fallback directly — `if (live) return mapped;` — so once
 * `cms` existed as an object, ANY shape of `cms.insurance` (missing, null,
 * a string, or a genuinely empty array) skipped the fallback and rendered
 * whatever `mapped` came out to, including [].
 *
 * mapFaqs()/mapFeesFaqs() share this exact `if (live) return mapped;`
 * pattern, and the Admin UI can genuinely produce a live, non-empty CMS
 * payload with zero insurance rows (unpublish everything) — that's a
 * deliberate empty state this codebase's established contract treats as
 * authoritative, not a defect to paper over. So this fix does NOT change
 * that case. It only changes the cases the Admin UI can never actually
 * produce for this field — undefined, null, or non-array — which are
 * malformed data, not a deliberate choice, and now always fall back
 * regardless of `live`.
 *
 * No network calls, no CMS, no Production data.
 *
 *   npx tsx --test scripts/test-insurance-resolver-resilience.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapInsurance } from '../src/lib/cms-resolve.ts';
import { insuranceCarriers as staticInsurance } from '../src/data/marketing.ts';

const LIVE_ROW = { name: 'Aetna (Commercial)', logo_url: '/images/insurance/badges/aetna-commercial.svg' };

test('missing `insurance` property on a live CMS payload falls back to the static list', () => {
  const cms = {};
  const result = mapInsurance(cms, true);
  assert.deepEqual(result, staticInsurance);
});

test('`insurance: null` on a live CMS payload falls back to the static list', () => {
  const cms = { insurance: null };
  const result = mapInsurance(cms, true);
  assert.deepEqual(result, staticInsurance);
});

test('a non-array `insurance` value (malformed response) falls back to the static list', () => {
  const cms = { insurance: 'not-an-array' };
  const result = mapInsurance(cms, true);
  assert.deepEqual(result, staticInsurance);
});

test('a non-array `insurance` object value also falls back to the static list', () => {
  const cms = { insurance: { oops: true } };
  const result = mapInsurance(cms, true);
  assert.deepEqual(result, staticInsurance);
});

test('a genuinely empty `insurance` array on a live CMS payload is respected as an intentional empty state, not overridden', () => {
  // This preserves the existing, established contract shared with
  // mapFaqs()/mapFeesFaqs() — deliberately publishing zero rows is a real
  // Admin action, and this function must not silently reintroduce stale
  // static payers over that choice.
  const cms = { insurance: [] };
  const result = mapInsurance(cms, true);
  assert.deepEqual(result, []);
});

test('a valid non-empty `insurance` array on a live CMS payload remains fully CMS-authoritative', () => {
  const cms = { insurance: [LIVE_ROW] };
  const result = mapInsurance(cms, true);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Aetna (Commercial)');
  assert.match(result[0].logo, /aetna-commercial\.svg$/);
});

test('a malformed individual row (no name) is excluded, not merged with fallback, without invalidating the rest of the collection', () => {
  const cms = { insurance: [LIVE_ROW, { logo_url: '/images/insurance/badges/optum.svg' }] };
  const result = mapInsurance(cms, true);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Aetna (Commercial)');
});

test('a row missing logo_url falls back to the shared placeholder, not the static list', () => {
  const cms = { insurance: [{ name: 'Some New Payer' }] };
  const result = mapInsurance(cms, true);
  assert.equal(result.length, 1);
  assert.equal(result[0].logo, '/images/insurance/insurance-placeholder.svg');
});

test('cms === null (fetch failed entirely) still falls back to the static list — pre-existing, unmodified behavior', () => {
  const result = mapInsurance(null, false);
  assert.deepEqual(result, staticInsurance);
});

test('live === false with an empty array still falls back — pre-existing, unmodified behavior', () => {
  const result = mapInsurance({ insurance: [] }, false);
  assert.deepEqual(result, staticInsurance);
});
