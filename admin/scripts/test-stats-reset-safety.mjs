/**
 * Pure regression tests for the homepage "Reset to approved defaults" stats
 * safety fix (P3-E2B): admin/src/components/HomepageCopy.tsx's
 * APPROVED_STATS must never make a homepage stat publicly visible while
 * the owner's "keep everything hidden" decision stands.
 *
 * No network calls, no CMS, no production data, no React rendering —
 * this only inspects the exported APPROVED_STATS constant and reproduces
 * resetStatsToApproved()'s trivial clone transformation.
 *
 *   npx tsx --test scripts/test-stats-reset-safety.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_STATS } from '../src/components/HomepageCopy.tsx';

/** Mirrors resetStatsToApproved()'s exact transformation: a shallow clone. */
function simulateReset() {
  return APPROVED_STATS.map((s) => ({ ...s }));
}

test('A. every APPROVED_STATS item has hidden === true', () => {
  assert.ok(APPROVED_STATS.length > 0, 'expected at least one approved stat to test');
  for (const stat of APPROVED_STATS) {
    assert.equal(stat.hidden, true, `expected ${stat.label} to be hidden`);
  }
});

test('B. resetStatsToApproved() cannot produce hidden === false for any homepage stat', () => {
  const reset = simulateReset();
  assert.ok(reset.every((s) => s.hidden === true));
});

test('C. "Secure Online Access" (24/7) specifically remains hidden after reset', () => {
  const reset = simulateReset();
  const stat = reset.find((s) => s.label === 'Secure Online Access');
  assert.ok(stat, 'expected a Secure Online Access entry');
  assert.equal(stat.hidden, true);
  assert.equal(stat.value, '24');
  assert.equal(stat.suffix, '/7');
});

test('D. "Years of Experience" (15+) specifically remains hidden after reset', () => {
  const reset = simulateReset();
  const stat = reset.find((s) => s.label === 'Years of Experience');
  assert.ok(stat, 'expected a Years of Experience entry');
  assert.equal(stat.hidden, true);
  assert.equal(stat.value, '15');
  assert.equal(stat.suffix, '+');
});

test('E. no reset path restores "Online Sessions Completed" (6000+) visibly — it is not part of the reset set at all', () => {
  const reset = simulateReset();
  const stat = reset.find((s) => /6000|Online Sessions/i.test(`${s.value}${s.label}`));
  assert.equal(stat, undefined, 'the 6000+ stat should not be part of APPROVED_STATS');
});

test('F. no reset path restores "Client Satisfaction Rate" (98%) visibly — it is not part of the reset set at all', () => {
  const reset = simulateReset();
  const stat = reset.find((s) => /98|Client Satisfaction/i.test(`${s.value}${s.label}`));
  assert.equal(stat, undefined, 'the 98% stat should not be part of APPROVED_STATS');
});

test('G. reset does not alter the underlying approved values/labels, only ensures they start hidden', () => {
  const reset = simulateReset();
  const labels = reset.map((s) => s.label).sort();
  assert.deepEqual(labels, ['Licensed Provider', 'Secure Online Access', 'Years of Experience'].sort());
  const licensedProvider = reset.find((s) => s.label === 'Licensed Provider');
  assert.equal(licensedProvider.value, '1');
  assert.equal(licensedProvider.suffix, '');
});

test('H. requiresVerification is present and false on every approved default (P3-E2 field still recognized, not repurposed)', () => {
  for (const stat of APPROVED_STATS) {
    assert.equal(typeof stat.requiresVerification, 'boolean');
    assert.equal(stat.requiresVerification, false);
  }
});

test('reset produces independent clones, not shared references to APPROVED_STATS (mutation safety)', () => {
  const reset = simulateReset();
  reset[0].hidden = false;
  assert.equal(APPROVED_STATS[0].hidden, true, 'mutating a reset clone must not affect the source constant');
});
