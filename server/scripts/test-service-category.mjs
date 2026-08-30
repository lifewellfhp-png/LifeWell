/**
 * Pure unit tests for the service `category` validation rules
 * (server/src/validation/adminSchemas.ts) that back G5's safety fix:
 * a new service must be given an explicit category on create, while
 * editing an existing (possibly still-uncategorized) service through the
 * Admin form — which resubmits every field on every save — must never be
 * rejected just because category is null/''/omitted.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-service-category.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceCreate, serviceUpdate } from '../src/validation/adminSchemas.js';

const BASE = { slug: 'new-service', title: 'New Service' };

test('CREATE with a valid category succeeds', () => {
  const result = serviceCreate.safeParse({ ...BASE, category: 'psychiatric' });
  assert.equal(result.success, true);
  assert.equal(result.data.category, 'psychiatric');
});

test('CREATE without category is rejected', () => {
  const result = serviceCreate.safeParse({ ...BASE });
  assert.equal(result.success, false);
});

test('CREATE with category: null is rejected', () => {
  const result = serviceCreate.safeParse({ ...BASE, category: null });
  assert.equal(result.success, false);
});

test('CREATE with category: "" is rejected', () => {
  const result = serviceCreate.safeParse({ ...BASE, category: '' });
  assert.equal(result.success, false);
});

test('CREATE with an invalid category value is rejected', () => {
  const result = serviceCreate.safeParse({ ...BASE, category: 'wellness' });
  assert.equal(result.success, false);
});

test('UPDATE omitting category succeeds (no unrelated-field-save failure)', () => {
  const result = serviceUpdate.safeParse({ title: 'Renamed Service' });
  assert.equal(result.success, true);
  assert.equal(Object.hasOwn(result.data, 'category'), false);
});

test('UPDATE with category: null succeeds (legacy uncategorized row, Admin resubmits every field)', () => {
  const result = serviceUpdate.safeParse({ title: 'Renamed Service', category: null });
  assert.equal(result.success, true);
  assert.equal(result.data.category, null);
});

test('UPDATE with category: "" succeeds and normalizes to null', () => {
  const result = serviceUpdate.safeParse({ title: 'Renamed Service', category: '' });
  assert.equal(result.success, true);
  assert.equal(result.data.category, null);
});

test('UPDATE with a valid category succeeds and keeps the real value', () => {
  const result = serviceUpdate.safeParse({ category: 'primary-care' });
  assert.equal(result.success, true);
  assert.equal(result.data.category, 'primary-care');
});

test('UPDATE with an invalid category value is still rejected', () => {
  const result = serviceUpdate.safeParse({ category: 'wellness' });
  assert.equal(result.success, false);
});
