/**
 * Regression tests for the public analytics/conversions rate limiters
 * (P4-G2 / P4-G2A).
 *
 * Spins up minimal Express apps mounting only the limiters under test in
 * front of a stub 200 handler — not the real controllers, which need a live
 * Supabase connection. This isolates exactly what changed: the limiters'
 * attach points and threshold behavior. Mirrors the established pattern in
 * test-admin-login-rate-limit.mjs.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-public-write-rate-limit.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  analyticsLimiter,
  conversionLimiter,
  contactLimiter,
  newsletterLimiter,
  adminLoginLimiter,
  changePasswordLimiter,
} from '../src/middleware/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const middlewareSource = readFileSync(join(root, 'src/middleware/index.ts'), 'utf8');
const routesSource = readFileSync(join(root, 'src/routes/index.ts'), 'utf8');
const analyticsControllerSource = readFileSync(join(root, 'src/controllers/analytics.controller.ts'), 'utf8');

function startStubServer(limiter, path = '/x') {
  return new Promise((resolve) => {
    const app = express();
    app.post(path, limiter, (_req, res) => res.status(200).json({ success: true }));
    const server = app.listen(0, () => resolve(server));
  });
}

/**
 * Fires requests until a 429 is returned or `maxAttempts` is reached.
 * Deliberately does not assume the limiter starts fresh — C9 (see below)
 * legitimately consumes a couple of requests from each limiter's shared,
 * module-singleton budget before these tests run, so asserting an exact
 * fixed breakpoint would be order-fragile. What actually matters — the
 * configured max is respected and a 429 eventually appears — holds
 * regardless of exactly how much headroom was already used.
 */
async function fireUntil429(port, path, maxAttempts) {
  const statuses = [];
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST' });
    statuses.push(res.status);
    if (res.status === 429) return statuses;
  }
  return statuses;
}

function startCombinedStubServer() {
  return new Promise((resolve) => {
    const app = express();
    app.post('/api/public/analytics', analyticsLimiter, (_req, res) => res.status(200).json({ success: true }));
    app.post('/api/public/conversions', conversionLimiter, (_req, res) => res.status(200).json({ success: true }));
    const server = app.listen(0, () => resolve(server));
  });
}

// --- A. Analytics ---------------------------------------------------------

test('A1. analyticsLimiter is exported as a function', () => {
  assert.equal(typeof analyticsLimiter, 'function');
});

test('A1b. analyticsLimiter is attached to POST /api/public/analytics in routes/index.ts', () => {
  assert.match(routesSource, /router\.post\(\s*'\/api\/public\/analytics',\s*analyticsLimiter/);
});

// analyticsLimiter/conversionLimiter are singletons (imported once), so
// their in-memory counters persist across every test in this file — later
// tests here deliberately exhaust each one to its floor. This test must
// therefore run before analyticsLimiter's own budget is exhausted (hence
// its placement here, right after the basic existence/attachment checks) —
// it proves independence via the *delta* in RateLimit-Remaining across two
// analytics requests with unrelated conversion traffic sandwiched between
// them: a drop of exactly 1 (not 4) proves conversion traffic never
// touches analytics' own counter.
test('C9. analytics and conversions use separate limiter budgets (proven via independent RateLimit-Remaining deltas)', async () => {
  const server = await startCombinedStubServer();
  const { port } = server.address();
  try {
    const a1 = await fetch(`http://127.0.0.1:${port}/api/public/analytics`, { method: 'POST' });
    const before = Number(a1.headers.get('ratelimit-remaining'));

    // Three conversion requests in between — must not touch analytics' own counter.
    for (let i = 0; i < 3; i++) {
      await fetch(`http://127.0.0.1:${port}/api/public/conversions`, { method: 'POST' });
    }

    const a2 = await fetch(`http://127.0.0.1:${port}/api/public/analytics`, { method: 'POST' });
    const after = Number(a2.headers.get('ratelimit-remaining'));

    // Exactly one more analytics request was made between the two checks
    // (a2 itself) — if conversion traffic were sharing analytics' budget,
    // the drop would be 4, not 1.
    assert.equal(before - after, 1, 'conversion traffic must not consume analytics budget');
  } finally {
    server.close();
  }
});

test('A2/A3. requests below threshold succeed; the request that crosses the 60/5min limit returns 429', async () => {
  const server = await startStubServer(analyticsLimiter);
  const { port } = server.address();
  try {
    // Bounded above by 60 + 5 to allow for C9's small prior consumption of
    // this same singleton limiter (see fireUntil429's doc comment).
    const statuses = await fireUntil429(port, '/x', 65);
    assert.ok(statuses.length <= 61, `should reach 429 at or before the 61st request in this run, got ${statuses.length}`);
    assert.equal(statuses[statuses.length - 1], 429, 'the final observed status must be 429');
    assert.equal(statuses.slice(0, -1).every((s) => s === 200), true, 'every request before the 429 must have succeeded');
  } finally {
    server.close();
  }
});

test('A4. the analytics 429 response uses the existing API error shape', async () => {
  // Runs after A2/A3, which already exhausted analyticsLimiter's budget —
  // any further request on this same singleton returns 429 immediately.
  const server = await startStubServer(analyticsLimiter);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/x`, { method: 'POST' });
    const body = await res.json();
    assert.equal(res.status, 429);
    assert.equal(body.success, false);
    assert.match(body.message, /too many analytics requests/i);
  } finally {
    server.close();
  }
});

// --- B. Conversions --------------------------------------------------------

test('B1. conversionLimiter is exported as a function', () => {
  assert.equal(typeof conversionLimiter, 'function');
});

test('B1b. conversionLimiter is attached to POST /api/public/conversions in routes/index.ts', () => {
  assert.match(routesSource, /router\.post\(\s*'\/api\/public\/conversions',\s*conversionLimiter/);
});

test('B2/B3. requests below threshold succeed; the request that crosses the 10/hour limit returns 429', async () => {
  // C9 already used 3 requests from this same singleton limiter — bounded
  // above by 10 + 5 to accommodate that (see fireUntil429's doc comment).
  const server = await startStubServer(conversionLimiter);
  const { port } = server.address();
  try {
    const statuses = await fireUntil429(port, '/x', 15);
    assert.ok(statuses.length <= 11, `should reach 429 at or before the 11th request in this run, got ${statuses.length}`);
    assert.equal(statuses[statuses.length - 1], 429, 'the final observed status must be 429');
    assert.equal(statuses.slice(0, -1).every((s) => s === 200), true, 'every request before the 429 must have succeeded');
  } finally {
    server.close();
  }
});

test('B4. the conversion 429 response uses the existing API error shape', async () => {
  // Runs after B2/B3, which already exhausted conversionLimiter's budget —
  // any further request on this same singleton returns 429 immediately.
  const server = await startStubServer(conversionLimiter);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/x`, { method: 'POST' });
    const body = await res.json();
    assert.equal(res.status, 429);
    assert.equal(body.success, false);
    assert.match(body.message, /too many tracking requests/i);
  } finally {
    server.close();
  }
});

// --- C. Regressions ---------------------------------------------------------

test('C10. contactLimiter configuration is unchanged (5/hour)', () => {
  assert.match(
    middlewareSource,
    /export const contactLimiter = limiter\(\s*HOUR_MS,\s*env\.RATE_LIMIT_CONTACT,/
  );
});

test('C11. newsletterLimiter configuration is unchanged (3/hour)', () => {
  assert.match(
    middlewareSource,
    /export const newsletterLimiter = limiter\(\s*HOUR_MS,\s*env\.RATE_LIMIT_NEWSLETTER,/
  );
});

test('C12. adminLoginLimiter configuration is unchanged (5/15min)', () => {
  assert.match(
    middlewareSource,
    /export const adminLoginLimiter = limiter\(\s*15 \* 60 \* 1000,\s*env\.RATE_LIMIT_ADMIN_LOGIN,/
  );
});

test('C13. changePasswordLimiter configuration is unchanged (5/15min)', () => {
  assert.match(
    middlewareSource,
    /export const changePasswordLimiter = limiter\(\s*15 \* 60 \* 1000,\s*env\.RATE_LIMIT_ADMIN_LOGIN,/
  );
});

test('C13b. all four pre-existing limiters remain distinct middleware functions from the two new ones', () => {
  const fns = [
    contactLimiter,
    newsletterLimiter,
    adminLoginLimiter,
    changePasswordLimiter,
    analyticsLimiter,
    conversionLimiter,
  ];
  const unique = new Set(fns);
  assert.equal(unique.size, fns.length, 'every limiter must be a distinct middleware instance');
});

test('C14. no custom keyGenerator was introduced for the new limiters — the shared limiter() factory (default req.ip key) is reused', () => {
  const analyticsBlock = middlewareSource.slice(
    middlewareSource.indexOf('export const analyticsLimiter'),
    middlewareSource.indexOf('export const conversionLimiter')
  );
  const conversionBlock = middlewareSource.slice(middlewareSource.indexOf('export const conversionLimiter'));
  assert.doesNotMatch(analyticsBlock, /keyGenerator/);
  assert.doesNotMatch(conversionBlock, /keyGenerator/);
  assert.match(analyticsBlock, /= limiter\(/);
  assert.match(conversionBlock, /= limiter\(/);
});

test('C14b. the shared limiter() factory itself still has no keyGenerator anywhere in this file', () => {
  assert.doesNotMatch(middlewareSource, /keyGenerator/);
});

test('C15. no req.ip or forwarded-header value is logged or persisted anywhere in this file or the analytics controller', () => {
  assert.doesNotMatch(middlewareSource, /req\.ip|request\.ip|x-forwarded-for/i);
  assert.doesNotMatch(analyticsControllerSource, /req\.ip|request\.ip|x-forwarded-for/i);
});

test('C15b. the shared limiter() factory options are unchanged: standardHeaders true, legacyHeaders false, skipFailedRequests false', () => {
  const factory = middlewareSource.slice(
    middlewareSource.indexOf('const limiter ='),
    middlewareSource.indexOf('const HOUR_MS')
  );
  assert.match(factory, /standardHeaders:\s*true/);
  assert.match(factory, /legacyHeaders:\s*false/);
  assert.match(factory, /skipFailedRequests:\s*false/);
});

test('C16. the analytics/conversions controllers were not modified — validation and success-response contracts unchanged', () => {
  assert.match(analyticsControllerSource, /analyticsIngestSchema\.safeParse\(req\.body\)/);
  assert.match(analyticsControllerSource, /res\.status\(201\)\.json\(\{ success: true \}\)/);
  assert.match(analyticsControllerSource, /conversionIngestSchema\.safeParse\(req\.body\)/);
  assert.match(analyticsControllerSource, /email\|phone\|name\|message\|dob\|ssn\|mrn/);
});

test('no new environment variables were introduced for these thresholds — hardcoded per P4-G2A', () => {
  assert.doesNotMatch(middlewareSource, /RATE_LIMIT_ANALYTICS|RATE_LIMIT_CONVERSIONS/);
});
