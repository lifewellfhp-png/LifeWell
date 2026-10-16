/**
 * Regression tests for Phase 1 item 5's zod schemas
 * (src/validation/adminSchemas.ts: mfaSetupVerifySchema, mfaDisableSchema,
 * mfaLoginVerifySchema).
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-mfa-validation-schemas.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mfaSetupVerifySchema,
  mfaDisableSchema,
  mfaLoginVerifySchema,
} from '../src/validation/adminSchemas.ts';

test('1. mfaSetupVerifySchema accepts a 6-digit code', () => {
  assert.equal(mfaSetupVerifySchema.safeParse({ code: '123456' }).success, true);
});

test('2. mfaSetupVerifySchema rejects non-6-digit input', () => {
  for (const bad of ['12345', '1234567', 'abcdef', '', '123 456']) {
    assert.equal(mfaSetupVerifySchema.safeParse({ code: bad }).success, false, `expected "${bad}" to be rejected`);
  }
});

test('3. mfaSetupVerifySchema trims surrounding whitespace before checking shape', () => {
  assert.equal(mfaSetupVerifySchema.safeParse({ code: ' 123456 ' }).success, true);
});

test('4. mfaDisableSchema requires a non-empty current_password', () => {
  assert.equal(mfaDisableSchema.safeParse({ current_password: 'x' }).success, true);
  assert.equal(mfaDisableSchema.safeParse({ current_password: '' }).success, false);
  assert.equal(mfaDisableSchema.safeParse({}).success, false);
});

test('5. mfaLoginVerifySchema accepts mfa_token + code', () => {
  const result = mfaLoginVerifySchema.safeParse({ mfa_token: 't', code: '123456' });
  assert.equal(result.success, true);
});

test('6. mfaLoginVerifySchema accepts mfa_token + recovery_code', () => {
  const result = mfaLoginVerifySchema.safeParse({ mfa_token: 't', recovery_code: 'ABCD-1234' });
  assert.equal(result.success, true);
});

test('7. mfaLoginVerifySchema rejects BOTH code and recovery_code present at once', () => {
  const result = mfaLoginVerifySchema.safeParse({ mfa_token: 't', code: '123456', recovery_code: 'ABCD-1234' });
  assert.equal(result.success, false);
});

test('8. mfaLoginVerifySchema rejects NEITHER code nor recovery_code present', () => {
  const result = mfaLoginVerifySchema.safeParse({ mfa_token: 't' });
  assert.equal(result.success, false);
});

test('9. mfaLoginVerifySchema rejects a missing mfa_token', () => {
  const result = mfaLoginVerifySchema.safeParse({ code: '123456' });
  assert.equal(result.success, false);
});
