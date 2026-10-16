/**
 * Regression tests for maskEmail (src/lib/maskEmail.ts) — used to mask the
 * raw, unverified email on a failed login's unknown-email/inactive-account
 * branch, in case a password was mistakenly typed into the email field.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-mask-email.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail } from '../src/lib/maskEmail.ts';

test('1. masks a normal email to first-2-chars + *** + full domain', () => {
  assert.equal(maskEmail('lourdie@gmail.com'), 'lo***@gmail.com');
});

test('2. a one-character local part shows just that one character', () => {
  assert.equal(maskEmail('a@gmail.com'), 'a***@gmail.com');
});

test('3. a value with no @ at all (e.g. a password typed into the email field) is fully masked, nothing revealed', () => {
  assert.equal(maskEmail('Sup3rSecret!2026'), '***');
});

test('4. a value starting with @ (empty local part) is fully masked', () => {
  assert.equal(maskEmail('@gmail.com'), '***');
});

test('5. the domain portion is never masked, only the local part', () => {
  const masked = maskEmail('jane.doe@lifewellfhp.com');
  assert.match(masked, /@lifewellfhp\.com$/);
});

test('6. an empty string is fully masked, not thrown on', () => {
  assert.equal(maskEmail(''), '***');
});
