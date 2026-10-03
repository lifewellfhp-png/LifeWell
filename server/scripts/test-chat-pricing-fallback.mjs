/**
 * Regression tests for the server-side pricing resolver
 * (server/src/lib/chatFacts.ts's resolvePsychiatricStatePricing), a port of
 * client/src/lib/cms-resolve.ts's resolver of the same name. Proves the
 * identical all-or-nothing validation contract: a CMS collection is used
 * only if it is complete and fully valid; any single defect anywhere falls
 * back to CHAT_PRICING_FALLBACK.
 *
 * No network calls, no CMS, no Production data.
 *
 *   npx tsx --test scripts/test-chat-pricing-fallback.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePsychiatricStatePricing, CHAT_PRICING_FALLBACK } from '../src/lib/chatFacts.ts';

const VALID = [
  { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 250, followUpFee: 150 },
  { state: 'Massachusetts', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 350, followUpFee: 175 },
  { state: 'Arizona', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 325, followUpFee: 165 },
];

test('1. a complete, valid CMS collection is used as-is', () => {
  const result = resolvePsychiatricStatePricing(VALID);
  assert.deepEqual(result, VALID);
});

test('2. a valid collection in a different order is reordered to canonical Florida/Massachusetts/Arizona', () => {
  const reordered = [VALID[2], VALID[0], VALID[1]];
  const result = resolvePsychiatricStatePricing(reordered);
  assert.deepEqual(result.map((s) => s.state), ['Florida', 'Massachusetts', 'Arizona']);
});

test('3. null/undefined/non-array input falls back', () => {
  assert.deepEqual(resolvePsychiatricStatePricing(null), CHAT_PRICING_FALLBACK);
  assert.deepEqual(resolvePsychiatricStatePricing(undefined), CHAT_PRICING_FALLBACK);
  assert.deepEqual(resolvePsychiatricStatePricing('not an array'), CHAT_PRICING_FALLBACK);
});

test('4. wrong entry count falls back', () => {
  assert.deepEqual(resolvePsychiatricStatePricing(VALID.slice(0, 2)), CHAT_PRICING_FALLBACK);
  assert.deepEqual(resolvePsychiatricStatePricing([...VALID, VALID[0]]), CHAT_PRICING_FALLBACK);
});

test('5. a governance flag mismatch falls back', () => {
  const tampered = [{ ...VALID[0], selfPayOnly: true }, VALID[1], VALID[2]];
  assert.deepEqual(resolvePsychiatricStatePricing(tampered), CHAT_PRICING_FALLBACK);
});

test('6. a zero, negative, or non-numeric fee falls back', () => {
  for (const badFee of [0, -5, '250', null, undefined, NaN]) {
    const tampered = [{ ...VALID[0], initialFee: badFee }, VALID[1], VALID[2]];
    assert.deepEqual(resolvePsychiatricStatePricing(tampered), CHAT_PRICING_FALLBACK, `expected fee ${badFee} to be rejected`);
  }
});

test('7. a duplicate state falls back', () => {
  const duplicated = [VALID[0], VALID[0], VALID[1]];
  assert.deepEqual(resolvePsychiatricStatePricing(duplicated), CHAT_PRICING_FALLBACK);
});

test('8. an unrecognized state name falls back', () => {
  const tampered = [{ ...VALID[0], state: 'Texas' }, VALID[1], VALID[2]];
  assert.deepEqual(resolvePsychiatricStatePricing(tampered), CHAT_PRICING_FALLBACK);
});

test('9. CHAT_PRICING_FALLBACK holds exactly the current approved figures', () => {
  assert.deepEqual(CHAT_PRICING_FALLBACK, VALID);
});
