/**
 * Regression tests for mapStats() (client/src/lib/cms-resolve.ts) — P3-E2
 * left this function completely unchanged (the governance fix lives
 * server-side, in enforceStatsVerificationGate()); these tests exist to
 * prove that's actually true: hidden items still never render, and the
 * function's behavior with today's live (all-hidden) data is unaffected.
 *
 * No network calls, no CMS, no production data.
 *
 *   npx tsx --test scripts/test-stats-mapper.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStats } from '../src/lib/cms-resolve.ts';

function cmsWithStats(items) {
  return {
    sections: [{ page_key: 'home', section_key: 'stats', content: { items } }],
  };
}

test('A. all five current hidden items remain non-public (mirrors live production data)', () => {
  const cms = cmsWithStats([
    { label: 'Online Sessions Completed', value: 6000, suffix: '+', hidden: true },
    { label: 'Board-Certified Psychiatric Provider', value: 1, suffix: '+', hidden: true },
    { label: 'Years of Experience', value: 15, suffix: '+', hidden: true },
    { label: 'Client Satisfaction Rate', value: 98, suffix: '%', hidden: true },
    { label: 'Secure Online Access', value: 24, suffix: '/7', hidden: true },
  ]);
  assert.deepEqual(mapStats(cms), []);
});

test('B. a non-hidden, non-verification item renders normally (existing, unmodified behavior)', () => {
  const cms = cmsWithStats([{ label: 'Years of Experience', value: 15, suffix: '+', hidden: false }]);
  const result = mapStats(cms);
  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'Years of Experience');
  assert.equal(result[0].value, 15);
});

test('D. the 6000+ item, in its actual current live (hidden) state, stays absent from the client output', () => {
  // The server-side enforceStatsVerificationGate() is what prevents
  // `hidden: false` from ever reaching the public API for a
  // requiresVerification item in the first place; this test documents
  // that mapStats() itself is unmodified and still correctly excludes a
  // hidden item regardless of the reason it's hidden.
  const cms = cmsWithStats([{ label: 'Online Sessions Completed', value: 6000, suffix: '+', hidden: true }]);
  assert.deepEqual(mapStats(cms), []);
});

test('E. the 98% item stays absent while hidden', () => {
  const cms = cmsWithStats([{ label: 'Client Satisfaction Rate', value: 98, suffix: '%', hidden: true }]);
  assert.deepEqual(mapStats(cms), []);
});

test('G. hidden filtering never depends on requiresVerification — a hidden item without that field is still excluded', () => {
  const cms = cmsWithStats([{ label: 'X', value: 1, suffix: '', hidden: true }]);
  assert.deepEqual(mapStats(cms), []);
});

test('H. an all-hidden items array (today\'s live state) returns a valid empty array, not an error or fallback to static defaults', () => {
  const cms = cmsWithStats([
    { label: 'A', value: 1, suffix: '', hidden: true },
    { label: 'B', value: 2, suffix: '', hidden: true },
  ]);
  const result = mapStats(cms);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});
