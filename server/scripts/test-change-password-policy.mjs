/**
 * Pure unit tests for changePasswordSchema (server/src/validation/adminSchemas.ts).
 *
 * No network calls, no Supabase, no production data. Every password string
 * here is a synthetic, randomly-generated test fixture — never a real
 * credential — built at runtime so nothing password-shaped is a fixed
 * literal in source control.
 *
 * Requires ADMIN_JWT_SECRET (adminSchemas.ts doesn't need it directly, but
 * nothing else in this repo's test setup does either — no env dependency
 * for this file specifically). Run with:
 *
 *   npx tsx --test scripts/test-change-password-policy.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { changePasswordSchema } from '../src/validation/adminSchemas.js';

/** A password guaranteed to satisfy every character-class requirement. */
function randomStrongPassword() {
  const filler = randomBytes(8).toString('base64url');
  return `Aa1!${filler}`;
}

function validBody(overrides = {}) {
  const pw = randomStrongPassword();
  return {
    current_password: randomBytes(6).toString('base64url'),
    new_password: pw,
    confirm_password: pw,
    ...overrides,
  };
}

test('A. a strong, matching password is accepted', () => {
  const result = changePasswordSchema.safeParse(validBody());
  assert.equal(result.success, true);
});

test('B. current_password is required', () => {
  const body = validBody({ current_password: '' });
  const result = changePasswordSchema.safeParse(body);
  assert.equal(result.success, false);
});

test('C. weak password: too short is rejected', () => {
  const body = validBody({ new_password: 'Aa1!abc', confirm_password: 'Aa1!abc' });
  const result = changePasswordSchema.safeParse(body);
  assert.equal(result.success, false);
});

test('D. weak password: missing uppercase is rejected', () => {
  const pw = `aa1!${randomBytes(8).toString('base64url').toLowerCase()}`;
  const result = changePasswordSchema.safeParse(validBody({ new_password: pw, confirm_password: pw }));
  assert.equal(result.success, false);
});

test('E. weak password: missing lowercase is rejected', () => {
  const pw = `AA1!${randomBytes(8).toString('base64url').toUpperCase()}`;
  const result = changePasswordSchema.safeParse(validBody({ new_password: pw, confirm_password: pw }));
  assert.equal(result.success, false);
});

test('F. weak password: missing a number is rejected', () => {
  const pw = `Aa!!${randomBytes(8).toString('base64url').replace(/[0-9]/g, 'x')}`;
  const result = changePasswordSchema.safeParse(validBody({ new_password: pw, confirm_password: pw }));
  assert.equal(result.success, false);
});

test('G. weak password: missing a symbol is rejected', () => {
  const pw = `Aa1${randomBytes(10).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x')}`;
  const result = changePasswordSchema.safeParse(validBody({ new_password: pw, confirm_password: pw }));
  assert.equal(result.success, false);
});

test('H. mismatched confirmation is rejected, with the error attached to confirm_password', () => {
  const body = validBody();
  body.confirm_password = randomStrongPassword();
  const result = changePasswordSchema.safeParse(body);
  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('confirm_password'));
});

test('I. an excessively long password is rejected (upper bound enforced)', () => {
  const pw = `Aa1!${'x'.repeat(200)}`;
  const result = changePasswordSchema.safeParse(validBody({ new_password: pw, confirm_password: pw }));
  assert.equal(result.success, false);
});
