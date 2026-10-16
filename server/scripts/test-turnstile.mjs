/**
 * Regression tests for Phase 1 item 7's server-side Cloudflare Turnstile
 * verification (src/lib/turnstile.ts).
 *
 * TURNSTILE_SECRET_KEY must be set BEFORE the first import of turnstile.ts
 * (config/env.ts's `env` object is parsed once at module load) — see
 * test-mfa-crypto.mjs for the same pattern with MFA_ENCRYPTION_KEY.
 *
 * globalThis.fetch is stubbed — no real network call is ever made to
 * Cloudflare.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     TURNSTILE_SECRET_KEY=test-turnstile-secret \
 *     npx tsx --test scripts/test-turnstile.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_JWT_SECRET ??= 'test-only-admin-jwt-secret-not-for-production-000000';
process.env.TURNSTILE_SECRET_KEY ??= 'test-turnstile-secret';

const { verifyTurnstile } = await import('../src/lib/turnstile.ts');

const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(impl) {
  globalThis.fetch = async (url, init) => impl(url, init);
}

test('1. a token Cloudflare accepts (success: true) passes', async () => {
  stubFetch(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
  assert.equal(await verifyTurnstile('good-token'), true);
});

test('2. a token Cloudflare rejects (success: false) fails', async () => {
  stubFetch(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 }));
  assert.equal(await verifyTurnstile('bad-token'), false);
});

test('3. an empty token still goes through to Cloudflare when configured (not special-cased client-side)', async () => {
  let seenBody;
  stubFetch(async (_url, init) => {
    seenBody = init.body.toString();
    return new Response(JSON.stringify({ success: false }), { status: 200 });
  });
  await verifyTurnstile('', '203.0.113.9');
  assert.match(seenBody, /response=/);
  assert.equal(await verifyTurnstile(''), false);
});

test('4. the secret and token are sent to Cloudflare\'s real verify endpoint', async () => {
  let seenUrl, seenBody;
  stubFetch(async (url, init) => {
    seenUrl = String(url);
    seenBody = init.body.toString();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });
  await verifyTurnstile('my-token');
  assert.equal(seenUrl, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.match(seenBody, /secret=test-turnstile-secret/);
  assert.match(seenBody, /response=my-token/);
});

test('5. remoteIp, when provided, is forwarded as remoteip', async () => {
  let seenBody;
  stubFetch(async (_url, init) => {
    seenBody = init.body.toString();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });
  await verifyTurnstile('my-token', '203.0.113.9');
  assert.match(seenBody, /remoteip=203\.0\.113\.9/);
});

test('6. a non-OK HTTP response from Cloudflare fails OPEN (returns true) rather than blocking real visitors', async () => {
  stubFetch(async () => new Response('error', { status: 500 }));
  assert.equal(await verifyTurnstile('my-token'), true);
});

test('7. a network error (fetch throws) fails OPEN', async () => {
  stubFetch(async () => {
    throw new Error('network down');
  });
  assert.equal(await verifyTurnstile('my-token'), true);
});

test('8. a malformed (non-JSON) response fails OPEN', async () => {
  stubFetch(async () => new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }));
  assert.equal(await verifyTurnstile('my-token'), true);
});
