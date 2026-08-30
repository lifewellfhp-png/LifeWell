/**
 * Pure unit tests for enforceStatsVerificationGate() (P3-E2):
 * server/src/routes/admin.routes.ts's home/stats governance guard, which
 * forces `hidden: true` on any stat item explicitly marked
 * `requiresVerification: true`, regardless of what was submitted,
 * scoped narrowly to page_key:'home', section_key:'stats'.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-stats-verification-gate.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceStatsVerificationGate } from '../src/routes/admin.routes.ts';

function statsPayload(items) {
  return { page_key: 'home', section_key: 'stats', content: { items } };
}

test('A. an item marked requiresVerification and submitted with hidden:false is forced to hidden:true', () => {
  const out = enforceStatsVerificationGate(
    statsPayload([{ label: 'Online Sessions Completed', value: 6000, suffix: '+', hidden: false, requiresVerification: true }])
  );
  assert.equal(out.content.items[0].hidden, true);
});

test('B. an item with requiresVerification: false and hidden:false passes through unchanged', () => {
  const out = enforceStatsVerificationGate(
    statsPayload([{ label: 'Years of Experience', value: 15, suffix: '+', hidden: false, requiresVerification: false }])
  );
  assert.equal(out.content.items[0].hidden, false);
});

test('C. a requiresVerification item that is already hidden stays hidden (no-op, not an error)', () => {
  const out = enforceStatsVerificationGate(
    statsPayload([{ label: 'Client Satisfaction Rate', value: 98, suffix: '%', hidden: true, requiresVerification: true }])
  );
  assert.equal(out.content.items[0].hidden, true);
});

test('D. the 6000+ fixture cannot become public under the new rule', () => {
  const out = enforceStatsVerificationGate(
    statsPayload([{ label: 'Online Sessions Completed', value: 6000, suffix: '+', hidden: false, requiresVerification: true }])
  );
  assert.equal(out.content.items[0].hidden, true);
});

test('E. the 98% fixture cannot become public under the new rule', () => {
  const out = enforceStatsVerificationGate(
    statsPayload([{ label: 'Client Satisfaction Rate', value: 98, suffix: '%', hidden: false, requiresVerification: true }])
  );
  assert.equal(out.content.items[0].hidden, true);
});

test('F. an unrelated, non-verification-required item (15+) in the same payload is untouched', () => {
  const out = enforceStatsVerificationGate(
    statsPayload([
      { label: 'Years of Experience', value: 15, suffix: '+', hidden: false, requiresVerification: false },
      { label: 'Online Sessions Completed', value: 6000, suffix: '+', hidden: false, requiresVerification: true },
    ])
  );
  assert.equal(out.content.items[0].hidden, false);
  assert.equal(out.content.items[0].label, 'Years of Experience');
  assert.equal(out.content.items[1].hidden, true);
});

test('G. the gate never mutates a payload for a different page_key/section_key', () => {
  const other = { page_key: 'fees', section_key: 'self_pay', content: { items: [{ hidden: false, requiresVerification: true }] } };
  const out = enforceStatsVerificationGate(other);
  assert.deepEqual(out, other);
});

test('G2. the gate never mutates a payload for a different section_key under page_key "home"', () => {
  const other = { page_key: 'home', section_key: 'hero', content: { badge: 'x' } };
  const out = enforceStatsVerificationGate(other);
  assert.deepEqual(out, other);
});

test('H. a payload with no content, or content without an items array, passes through unchanged (no crash)', () => {
  const noContent = { page_key: 'home', section_key: 'stats' };
  assert.deepEqual(enforceStatsVerificationGate(noContent), noContent);

  const noItems = { page_key: 'home', section_key: 'stats', content: { title: 'Stats band' } };
  assert.deepEqual(enforceStatsVerificationGate(noItems), noItems);
});

test('I. does not invent a verified/approved state — only ever forces hidden:true, never sets any other field', () => {
  const out = enforceStatsVerificationGate(
    statsPayload([{ label: 'X', value: 1, suffix: '', hidden: false, requiresVerification: true }])
  );
  const keys = Object.keys(out.content.items[0]).sort();
  assert.deepEqual(keys, ['hidden', 'label', 'requiresVerification', 'suffix', 'value']);
});

test('J. an update payload missing page_key/section_key (not the real Admin flow, a documented limitation) is not caught', () => {
  const partial = { content: { items: [{ hidden: false, requiresVerification: true }] } };
  const out = enforceStatsVerificationGate(partial);
  // Documents the known limitation rather than asserting a false guarantee.
  assert.equal(out.content.items[0].hidden, false);
});
