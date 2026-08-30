/**
 * Regression tests for the admin login rate limiter (P4-B1).
 *
 * Spins up a minimal Express app mounting only `adminLoginLimiter` in front
 * of a stub 200 handler — not the real /api/admin/auth/login route, which
 * needs a live Supabase connection. This isolates exactly what changed:
 * the limiter's own attach point and threshold behavior.
 *
 * Requires ADMIN_JWT_SECRET in the environment (server/src/config/env.ts
 * now fails closed with no default) — set a synthetic test-only value
 * before running, e.g.:
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-admin-login-rate-limit.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { adminLoginLimiter, contactLimiter } from '../src/middleware/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesSource = readFileSync(join(__dirname, '../src/routes/admin.routes.ts'), 'utf8');

function startStubServer(limiter) {
  return new Promise((resolve) => {
    const app = express();
    app.post('/login', limiter, (_req, res) => res.status(200).json({ success: true }));
    const server = app.listen(0, () => resolve(server));
  });
}

test('A. adminLoginLimiter is exported', () => {
  assert.equal(typeof adminLoginLimiter, 'function');
});

test('B. the login limiter is attached to POST /auth/login in admin.routes.ts', () => {
  assert.match(routesSource, /adminRouter\.post\(\s*'\/auth\/login',\s*adminLoginLimiter/);
});

test('B2. the login limiter is a distinct middleware from the contact/newsletter limiters', () => {
  assert.notEqual(adminLoginLimiter, contactLimiter);
});

test('C/D. threshold produces 429 after the limit, while requests under the limit still succeed', async () => {
  const server = await startStubServer(adminLoginLimiter);
  const { port } = server.address();
  try {
    const statuses = [];
    // RATE_LIMIT_ADMIN_LOGIN defaults to 5 — fire 6 requests from the same
    // (loopback) client and expect the first 5 to pass, the 6th to 429.
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST' });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses.slice(0, 5), [200, 200, 200, 200, 200], 'first 5 attempts should succeed');
    assert.equal(statuses[5], 429, '6th attempt within the window should be rate-limited');
  } finally {
    server.close();
  }
});

test('E. the 429 response does not reveal account existence or credential details', async () => {
  const server = await startStubServer(adminLoginLimiter);
  const { port } = server.address();
  try {
    let last;
    for (let i = 0; i < 6; i++) {
      last = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST' });
    }
    const body = await last.json();
    assert.equal(last.status, 429);
    assert.equal(typeof body.message, 'string');
    assert.doesNotMatch(body.message.toLowerCase(), /email|account|user|password|exist/);
  } finally {
    server.close();
  }
});

test('F. standard rate-limit headers are present, legacy headers are not', async () => {
  const server = await startStubServer(adminLoginLimiter);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST' });
    assert.ok(res.headers.get('ratelimit-limit') !== null || res.headers.get('RateLimit-Limit') !== null);
    assert.equal(res.headers.get('x-ratelimit-limit'), null);
  } finally {
    server.close();
  }
});
