/**
 * Regression tests for Phase 1 item 5's at-rest TOTP secret encryption
 * (src/lib/mfaCrypto.ts) — AES-256-GCM, keyed by MFA_ENCRYPTION_KEY.
 *
 * MFA_ENCRYPTION_KEY is read once into config/env.ts's cached `env` object
 * at first import, so it must be set correctly BEFORE this file's first
 * dynamic import of mfaCrypto.ts, via the shell invocation below — not
 * mutated mid-test (see test-mfa-crypto-bad-key.mjs for the one scenario
 * that specifically needs a bad value present from process start).
 *
 * No network calls, no Supabase, no production data.
 *
 *   MFA_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
 *     npx tsx --test scripts/test-mfa-crypto.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

if (!process.env.MFA_ENCRYPTION_KEY) {
  process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
}
process.env.ADMIN_JWT_SECRET ??= 'test-only-admin-jwt-secret-not-for-production-000000';

const { encryptMfaSecret, decryptMfaSecret } = await import('../src/lib/mfaCrypto.ts');

test('1. round-trips a TOTP secret through encrypt/decrypt unchanged', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const encrypted = encryptMfaSecret(secret);
  assert.equal(decryptMfaSecret(encrypted), secret);
});

test('2. two encryptions of the same plaintext produce different ciphertext (fresh random IV each time)', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  assert.notEqual(encryptMfaSecret(secret), encryptMfaSecret(secret));
});

test('3. the stored format is iv.authTag.ciphertext, all base64', () => {
  const stored = encryptMfaSecret('JBSWY3DPEHPK3PXP');
  const parts = stored.split('.');
  assert.equal(parts.length, 3);
  for (const part of parts) {
    assert.doesNotThrow(() => Buffer.from(part, 'base64'));
  }
});

test('4. decrypting with a tampered ciphertext byte fails (GCM auth tag catches it)', () => {
  const stored = encryptMfaSecret('JBSWY3DPEHPK3PXP');
  const [iv, tag, data] = stored.split('.');
  const tamperedByte = Buffer.from(data, 'base64');
  tamperedByte[0] = tamperedByte[0] ^ 0xff;
  const tampered = [iv, tag, tamperedByte.toString('base64')].join('.');
  assert.throws(() => decryptMfaSecret(tampered));
});

test('5. decrypting with a tampered auth tag fails', () => {
  const stored = encryptMfaSecret('JBSWY3DPEHPK3PXP');
  const [iv, tag, data] = stored.split('.');
  const tamperedTag = Buffer.from(tag, 'base64');
  tamperedTag[0] = tamperedTag[0] ^ 0xff;
  const tampered = [iv, tamperedTag.toString('base64'), data].join('.');
  assert.throws(() => decryptMfaSecret(tampered));
});

test('6. a malformed stored value (not three dot-separated parts) throws rather than returning garbage', () => {
  assert.throws(() => decryptMfaSecret('not-the-right-format'));
});
