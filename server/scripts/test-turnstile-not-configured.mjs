/**
 * Isolated from test-turnstile.mjs because this needs TURNSTILE_SECRET_KEY
 * absent from process start — config/env.ts's cached `env` object can't be
 * toggled mid-test (see test-mfa-crypto-bad-key.mjs for the same pattern).
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-turnstile-not-configured.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_JWT_SECRET ??= 'test-only-admin-jwt-secret-not-for-production-000000';
delete process.env.TURNSTILE_SECRET_KEY;

const { verifyTurnstile } = await import('../src/lib/turnstile.ts');

test('when TURNSTILE_SECRET_KEY is unset, verifyTurnstile passes everything without ever calling fetch', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}');
  };
  const result = await verifyTurnstile('any-token-or-even-empty');
  globalThis.fetch = originalFetch;
  assert.equal(result.ok, true);
  assert.equal(result.misconfigured, undefined, 'not-configured is a different case from misconfigured — no audit entry should fire for it');
  assert.equal(called, false, 'must not call Cloudflare at all when unconfigured');
});
