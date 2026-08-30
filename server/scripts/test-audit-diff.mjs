/**
 * Pure unit tests for diffChanges() (server/src/lib/audit.ts).
 *
 * No network calls, no Supabase, no production data — this only exercises
 * the in-memory diff function that decides what goes into an audit log
 * entry's `meta.changes`. Run with:
 *
 *   npx tsx --test scripts/test-audit-diff.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { diffChanges } from '../src/lib/audit.js';

test('boolean transition: published false -> true is recorded', () => {
  const before = { id: '1', published: false, quote: 'hello' };
  const payload = { published: true, updated_at: '2026-01-01T00:00:00Z' };
  const changes = diffChanges(before, payload);
  assert.deepEqual(changes, { published: { from: false, to: true } });
});

test('the testimonial example: published true -> false', () => {
  const before = { id: 'd67190c7', author_name: 'Elisa Smith', published: true, consent_confirmed: true };
  const payload = { published: false, updated_at: '2026-08-30T01:36:16.9Z' };
  const changes = diffChanges(before, payload);
  assert.deepEqual(changes, { published: { from: true, to: false } });
});

test('omitted field never appears even if it changed elsewhere', () => {
  // Only `quote` was in the PATCH body — `published` is absent from payload
  // entirely, so it must not appear in the diff even though `before` has it.
  const before = { id: '1', published: true, quote: 'old quote' };
  const payload = { quote: 'new quote', updated_at: 'x' };
  const changes = diffChanges(before, payload);
  assert.deepEqual(changes, { quote: { from: 'old quote', to: 'new quote' } });
  assert.equal(Object.hasOwn(changes, 'published'), false);
});

test('submitted-but-unchanged field is dropped', () => {
  const before = { id: '1', published: true, rating: 5 };
  const payload = { published: true, rating: 5, updated_at: 'x' };
  const changes = diffChanges(before, payload);
  assert.equal(changes, undefined);
});

test('null transitions are represented correctly', () => {
  const before = { id: '1', author_role: 'Patient' };
  const payload = { author_role: null, updated_at: 'x' };
  const changes = diffChanges(before, payload);
  assert.deepEqual(changes, { author_role: { from: 'Patient', to: null } });

  const before2 = { id: '1', author_role: null };
  const payload2 = { author_role: 'Patient', updated_at: 'x' };
  const changes2 = diffChanges(before2, payload2);
  assert.deepEqual(changes2, { author_role: { from: null, to: 'Patient' } });
});

test('string and number transitions', () => {
  const before = { id: '1', name: 'Old Name', sort_order: 1 };
  const payload = { name: 'New Name', sort_order: 2, updated_at: 'x' };
  const changes = diffChanges(before, payload);
  assert.deepEqual(changes, {
    name: { from: 'Old Name', to: 'New Name' },
    sort_order: { from: 1, to: 2 },
  });
});

test('array/object fields are safely compared and recorded', () => {
  const before = { id: '1', certifications: ['FNP-C'] };
  const payload = { certifications: ['FNP-C', 'PMHNP-BC'], updated_at: 'x' };
  const changes = diffChanges(before, payload);
  assert.deepEqual(changes, {
    certifications: { from: ['FNP-C'], to: ['FNP-C', 'PMHNP-BC'] },
  });
});

test('unchanged array/object field is dropped, not just reference-compared', () => {
  const before = { id: '1', certifications: ['FNP-C', 'PMHNP-BC'] };
  const payload = { certifications: ['FNP-C', 'PMHNP-BC'], updated_at: 'x' };
  const changes = diffChanges(before, payload);
  assert.equal(changes, undefined);
});

test('sensitive-looking field names are redacted, not recorded in plain text', () => {
  const before = { id: '1', access_token: 'super-secret-value', password_hash: 'abc123' };
  const payload = { access_token: 'rotated-secret', password_hash: 'def456', updated_at: 'x' };
  const changes = diffChanges(before, payload);
  assert.deepEqual(changes, {
    access_token: { from: '[redacted]', to: '[redacted]' },
    password_hash: { from: '[redacted]', to: '[redacted]' },
  });
  const serialized = JSON.stringify(changes);
  assert.equal(serialized.includes('super-secret-value'), false);
  assert.equal(serialized.includes('rotated-secret'), false);
});

test('long text values are truncated rather than stored unbounded', () => {
  const longBio = 'x'.repeat(2000);
  const before = { id: '1', bio: 'short' };
  const payload = { bio: longBio, updated_at: 'x' };
  const changes = diffChanges(before, payload);
  assert.equal(changes.bio.from, 'short');
  assert.ok(typeof changes.bio.to === 'string' && changes.bio.to.length < longBio.length);
  assert.ok(changes.bio.to.includes('truncated'));
});

test('no prior row (before is null/undefined) yields no diff rather than throwing', () => {
  assert.equal(diffChanges(null, { published: true }), undefined);
  assert.equal(diffChanges(undefined, { published: true }), undefined);
});

test('a value explicitly set to undefined in payload is treated as null, not skipped', () => {
  const before = { id: '1', author_role: 'Patient' };
  const payload = { author_role: undefined, updated_at: 'x' };
  const changes = diffChanges(before, payload);
  assert.deepEqual(changes, { author_role: { from: 'Patient', to: null } });
});
