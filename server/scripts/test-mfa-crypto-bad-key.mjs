/**
 * Isolated from test-mfa-crypto.mjs because this needs a wrong-length
 * MFA_ENCRYPTION_KEY present from process start, before config/env.ts's
 * cached `env` object is ever built — unlike a correctly-configured key,
 * this can't be exercised by mutating process.env mid-test.
 *
 *   MFA_ENCRYPTION_KEY=dG9vLXNob3J0 npx tsx --test scripts/test-mfa-crypto-bad-key.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_JWT_SECRET ??= 'test-only-admin-jwt-secret-not-for-production-000000';
process.env.MFA_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');

const { encryptMfaSecret } = await import('../src/lib/mfaCrypto.ts');

test('getKey() rejects a key that does not decode to exactly 32 bytes', () => {
  assert.throws(() => encryptMfaSecret('JBSWY3DPEHPK3PXP'), /32 bytes/);
});
