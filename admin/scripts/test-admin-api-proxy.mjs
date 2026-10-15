/**
 * Regression tests for Phase 1 item 3's admin API proxy
 * (admin/src/app/api/[...path]/route.ts) — the piece that makes the httpOnly
 * session cookie first-party: the browser only ever calls this app's own
 * same-origin /api/* routes, which forward to the real Express API
 * server-side, attaching Authorization from the cookie the browser never
 * sees directly.
 *
 * globalThis.fetch is stubbed for every test — no real network call is ever
 * made, and nothing hits the real Express API.
 *
 *   npx tsx --test scripts/test-admin-api-proxy.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/[...path]/route.ts';
import { SESSION_COOKIE } from '../src/lib/session.ts';

const originalFetch = globalThis.fetch;
let calls;

function stubFetch(impl) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return impl ? impl(url, init) : new Response(JSON.stringify({ success: true }), { status: 200 });
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function req(path, { method = 'GET', cookie, origin, body, headers = {} } = {}) {
  const h = new Headers(headers);
  if (cookie) h.set('cookie', `${SESSION_COOKIE}=${cookie}`);
  if (origin) h.set('origin', origin);
  if (body) h.set('content-type', 'application/json');
  return new NextRequest(`https://lifewellfhp-admin.vercel.app/api${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function ctx(path) {
  return { params: Promise.resolve({ path: path.split('/').filter(Boolean) }) };
}

test('1. a state-changing request with a mismatched Origin is rejected with 403, and never reaches fetch', async () => {
  stubFetch();
  const response = await POST(
    req('/admin/users', { method: 'POST', cookie: 'x', origin: 'https://evil.example.com', body: { a: 1 } }),
    ctx('admin/users')
  );
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test('2. a state-changing request with the correct Origin is forwarded', async () => {
  stubFetch();
  const response = await POST(
    req('/admin/users', {
      method: 'POST',
      cookie: 'x',
      origin: 'https://lifewellfhp-admin.vercel.app',
      body: { a: 1 },
    }),
    ctx('admin/users')
  );
  assert.equal(calls.length, 1);
  assert.notEqual(response.status, 403);
});

test('3. a GET request (not state-changing) is forwarded regardless of Origin', async () => {
  stubFetch();
  await GET(req('/admin/users', { origin: 'https://evil.example.com' }), ctx('admin/users'));
  assert.equal(calls.length, 1);
});

test('4. ADMIN_APP_URL, when set, is honored by the Origin check instead of the default', async () => {
  const before = process.env.ADMIN_APP_URL;
  process.env.ADMIN_APP_URL = 'https://staging-admin.example.com';
  stubFetch();
  const response = await POST(
    req('/admin/users', { method: 'POST', cookie: 'x', origin: 'https://lifewellfhp-admin.vercel.app', body: {} }),
    ctx('admin/users')
  );
  process.env.ADMIN_APP_URL = before;
  // The real ADMIN_APP_URL is now staging-admin.example.com, so the
  // production default origin must be rejected.
  assert.equal(response.status, 403);
});

test('5. the session cookie is attached as an Authorization Bearer header on the upstream call', async () => {
  stubFetch();
  await GET(req('/admin/users', { cookie: 'my-token-value' }), ctx('admin/users'));
  const sentHeaders = new Headers(calls[0].init.headers);
  assert.equal(sentHeaders.get('Authorization'), 'Bearer my-token-value');
});

test('6. no Authorization header is sent when there is no session cookie', async () => {
  stubFetch();
  await GET(req('/admin/users'), ctx('admin/users'));
  const sentHeaders = new Headers(calls[0].init.headers);
  assert.equal(sentHeaders.has('Authorization'), false);
});

test('7. the upstream URL reconstructs the path and forwards the query string', async () => {
  stubFetch();
  const request = new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/leads?page=2&pageSize=25');
  await GET(request, ctx('admin/leads'));
  assert.match(String(calls[0].url), /\/api\/admin\/leads\?page=2&pageSize=25$/);
});

test('8. x-forwarded-for is preserved across the proxy hop (rate limiting depends on the real client IP)', async () => {
  stubFetch();
  await GET(req('/admin/users', { headers: { 'x-forwarded-for': '203.0.113.9' } }), ctx('admin/users'));
  const sentHeaders = new Headers(calls[0].init.headers);
  assert.equal(sentHeaders.get('x-forwarded-for'), '203.0.113.9');
});

test('9. the upstream response status and content-type pass through unchanged', async () => {
  stubFetch(() => new Response(JSON.stringify({ success: false }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  }));
  const response = await GET(req('/admin/users'), ctx('admin/users'));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('content-type'), 'application/json');
});

test('10. the browser-sent Cookie header is never forwarded upstream (only the extracted Bearer token is)', async () => {
  stubFetch();
  await GET(req('/admin/users', { cookie: 'secret-session-value' }), ctx('admin/users'));
  const sentHeaders = new Headers(calls[0].init.headers);
  assert.equal(sentHeaders.has('Cookie'), false);
  assert.equal(sentHeaders.has('cookie'), false);
});
