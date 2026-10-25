/**
 * Regression tests for mapStats() and the homepage stats rendering contract.
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

test('hidden rows stay absent', () => {
  const cms = cmsWithStats([
    { label: 'Client Satisfaction Rate', value: 98, suffix: '%', hidden: true },
    { label: 'Secure Online Access', value: 24, suffix: '/7', visible: false },
  ]);
  assert.deepEqual(mapStats(cms), []);
});

test('a visible verified row renders normally', () => {
  const result = mapStats(cmsWithStats([{ label: 'Years of Experience', value: 15, suffix: '+', hidden: false }]));
  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'Years of Experience');
  assert.equal(result[0].value, 15);
});

test('requires-verification rows stay hidden even when visible', () => {
  const cms = cmsWithStats([{ label: 'Online Sessions Completed', value: 6000, suffix: '+', hidden: false, requiresVerification: true }]);
  assert.deepEqual(mapStats(cms), []);
  assert.deepEqual(mapStats(cmsWithStats([{ label: 'X', value: 1, suffix: '', visible: true, requires_verification: true }])), []);
});

test('one invalid row does not hide valid rows', () => {
  const cms = cmsWithStats([
    { label: 'Bad suffix', value: 10, suffix: 'days', hidden: false },
    { label: 'Secure Online Access', value: '24', suffix: '/7', hidden: false },
  ]);
  const result = mapStats(cms);
  assert.deepEqual(result.map(({ label }) => label), ['Secure Online Access']);
});

test('homepage shows only the first four visible rows in admin order', () => {
  const cms = cmsWithStats([
    { label: 'Fourth', value: 4, suffix: '+', order: 3 },
    { label: 'Hidden', value: 99, suffix: '+', hidden: true, order: 0 },
    { label: 'First', value: 1, suffix: '', order: 2 },
    { label: 'Second', value: 2, suffix: '%', order: 1 },
    { label: 'Third', value: 3, suffix: '+', order: 4 },
    { label: 'Fifth', value: 5, suffix: '+', order: 5 },
  ]);
  const result = mapStats(cms).slice(0, 4);
  assert.deepEqual(result.map(({ label }) => label), ['Second', 'First', 'Fourth', 'Third']);
});
