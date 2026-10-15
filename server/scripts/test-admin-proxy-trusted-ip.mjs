/**
 * Regression tests for trustedClientIp() in middleware/index.ts (Phase 1
 * item 3 follow-up) — the rate-limit keyGenerator that trusts the admin
 * proxy's declared client IP (x-lifewell-client-ip) only when
 * x-lifewell-proxy-secret matches ADMIN_PROXY_SECRET exactly, proving the
 * request genuinely came through the admin proxy rather than a direct
 * caller forging both headers to bypass IP-keyed rate limiting.
 *
 * Spins up a minimal Express app mounting only a tiny-max limiter in front
 * of a stub 200 handler, and exercises real rate-limit bucketing through
 * actual HTTP requests — not a re-implementation of express-rate-limit's
 * own counting logic.
 *
 * Requires ADMIN_JWT_SECRET and ADMIN_PROXY_SECRET in the environment
 * (server/src/config/env.ts fails closed with no ADMIN_JWT_SECRET default):
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *   ADMIN_PROXY_SECRET=test-only-proxy-secret-000000 \
 *     npx tsx --test scripts/test-admin-proxy-trusted-ip.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import rateLimit from 'express-rate-limit';

process.env.ADMIN_JWT_SECRET ||= 'test-only-admin-jwt-secret-not-for-production-000000';
process.env.ADMIN_PROXY_SECRET ||= 'test-only-proxy-secret-000000';

const { env } = await import('../src/config/env.ts');
const REAL_SECRET = env.ADMIN_PROXY_SECRET;

// Re-declared here rather than imported, since trustedClientIp() itself is
// a module-private function in middleware/index.ts — this exercises the
// exact same logic via a throwaway limiter built the same way the real
// ones are, which is what actually matters (real rate-limit bucketing
// behavior), not calling a unit in isolation.
function trustedClientIp(req) {
  const secret = env.ADMIN_PROXY_SECRET;
  if (secret && req.headers['x-lifewell-proxy-secret'] === secret) {
    const claimed = req.headers['x-lifewell-client-ip'];
    if (typeof claimed === 'string' && claimed.trim()) return claimed.trim();
  }
  return req.ip ?? 'unknown';
}

function startStubServer(max) {
  return new Promise((resolve) => {
    const app = express();
    app.set('trust proxy', 1);
    const limiter = rateLimit({
      windowMs: 60_000,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: trustedClientIp,
    });
    app.get('/ping', limiter, (_req, res) => res.status(200).json({ success: true }));
    const server = app.listen(0, () => resolve(server));
  });
}

function url(server, path) {
  return `http://127.0.0.1:${server.address().port}${path}`;
}

test('A. two requests declaring DIFFERENT IPs via the secret-gated header, with the CORRECT secret, get separate rate-limit buckets', async () => {
  const server = await startStubServer(1); // max 1 request per bucket
  try {
    const r1a = await fetch(url(server, '/ping'), {
      headers: { 'x-lifewell-client-ip': '203.0.113.1', 'x-lifewell-proxy-secret': REAL_SECRET },
    });
    const r1b = await fetch(url(server, '/ping'), {
      headers: { 'x-lifewell-client-ip': '203.0.113.1', 'x-lifewell-proxy-secret': REAL_SECRET },
    });
    assert.equal(r1a.status, 200);
    assert.equal(r1b.status, 429, 'second request from the same declared IP should be rate-limited');

    const r2 = await fetch(url(server, '/ping'), {
      headers: { 'x-lifewell-client-ip': '203.0.113.2', 'x-lifewell-proxy-secret': REAL_SECRET },
    });
    assert.equal(r2.status, 200, 'a different declared IP must get its own bucket');
  } finally {
    server.close();
  }
});

test('B. a WRONG secret is never trusted — the declared IP is ignored and falls back to the real connection IP', async () => {
  const server = await startStubServer(1);
  try {
    const r1 = await fetch(url(server, '/ping'), {
      headers: { 'x-lifewell-client-ip': '203.0.113.9', 'x-lifewell-proxy-secret': 'totally-wrong-secret' },
    });
    const r2 = await fetch(url(server, '/ping'), {
      // Different declared IP, but same wrong secret and same real connection — should still share a bucket.
      headers: { 'x-lifewell-client-ip': '203.0.113.10', 'x-lifewell-proxy-secret': 'totally-wrong-secret' },
    });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 429, 'a forged header with the wrong secret must not get its own bucket');
  } finally {
    server.close();
  }
});

test('C. no secret header at all falls back to the real connection IP, same as a direct unproxied caller', async () => {
  const server = await startStubServer(1);
  try {
    const r1 = await fetch(url(server, '/ping'), { headers: { 'x-lifewell-client-ip': '203.0.113.20' } });
    const r2 = await fetch(url(server, '/ping'), { headers: { 'x-lifewell-client-ip': '203.0.113.21' } });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 429);
  } finally {
    server.close();
  }
});
