/**
 * Regression tests for Phase 1 item 5's TOTP wrapper (src/lib/mfaTotp.ts),
 * pinned to otplib's stable v12 `authenticator` API — not the v13 rewrite,
 * which has a materially different class-based shape this codebase doesn't
 * use.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-mfa-totp.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticator } from 'otplib';
import { generateTotpSecret, buildOtpAuthUri, verifyTotpCode } from '../src/lib/mfaTotp.ts';

test('1. generateTotpSecret produces a valid base32 secret', () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]+=*$/);
  assert.ok(secret.length >= 16);
});

test('2. two calls produce different secrets', () => {
  assert.notEqual(generateTotpSecret(), generateTotpSecret());
});

test('3. verifyTotpCode accepts a code generated from the same secret right now', () => {
  const secret = generateTotpSecret();
  const code = authenticator.generate(secret);
  assert.equal(verifyTotpCode(secret, code), true);
});

test('4. verifyTotpCode rejects a code generated from a DIFFERENT secret', () => {
  const secretA = generateTotpSecret();
  const secretB = generateTotpSecret();
  const codeForB = authenticator.generate(secretB);
  assert.equal(verifyTotpCode(secretA, codeForB), false);
});

test('5. verifyTotpCode rejects garbage input instead of throwing', () => {
  const secret = generateTotpSecret();
  assert.equal(verifyTotpCode(secret, 'not-a-code'), false);
  assert.equal(verifyTotpCode(secret, ''), false);
});

test('6. buildOtpAuthUri is a valid otpauth:// URI containing the issuer and account email', () => {
  const secret = generateTotpSecret();
  const uri = buildOtpAuthUri('staff@lifewellfhp.com', secret);
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, /LifeWell(%20|\+)Admin/);
  assert.match(uri, /staff(%40|@)lifewellfhp\.com/);
  assert.match(uri, new RegExp(`secret=${secret}`));
});
