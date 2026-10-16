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

test('4. the Origin check compares against this request\'s own Host, not a configured URL — a Vercel preview\'s distinct domain is accepted with zero config', async () => {
  stubFetch();
  const request = new NextRequest('https://lifewellfhp-admin-git-some-branch-team.vercel.app/api/admin/users', {
    method: 'POST',
    headers: { cookie: `${SESSION_COOKIE}=x`, origin: 'https://lifewellfhp-admin-git-some-branch-team.vercel.app' },
    body: JSON.stringify({ a: 1 }),
  });
  const response = await POST(request, ctx('admin/users'));
  assert.notEqual(response.status, 403);
  assert.equal(calls.length, 1);
});

test('4b. a request whose Origin does NOT match its own Host is still rejected (e.g. a stale/forged Origin on a preview domain)', async () => {
  stubFetch();
  const request = new NextRequest('https://lifewellfhp-admin-git-some-branch-team.vercel.app/api/admin/users', {
    method: 'POST',
    // Origin claims production, but this request actually arrived at the preview host.
    headers: { cookie: `${SESSION_COOKIE}=x`, origin: 'https://lifewellfhp-admin.vercel.app' },
    body: JSON.stringify({ a: 1 }),
  });
  const response = await POST(request, ctx('admin/users'));
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test('4c. a state-changing request with NO Origin header at all is rejected, not silently allowed', async () => {
  stubFetch();
  const response = await POST(
    req('/admin/users', { method: 'POST', cookie: 'x', body: { a: 1 } }),
    ctx('admin/users')
  );
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
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

test('8. the raw x-forwarded-for/x-real-ip headers are never forwarded upstream verbatim (unauthenticated passthrough would let anyone spoof their rate-limit bucket)', async () => {
  stubFetch();
  await GET(req('/admin/users', { headers: { 'x-forwarded-for': '203.0.113.9' } }), ctx('admin/users'));
  const sentHeaders = new Headers(calls[0].init.headers);
  assert.equal(sentHeaders.has('x-forwarded-for'), false);
  assert.equal(sentHeaders.has('x-real-ip'), false);
});

test('8b. with ADMIN_PROXY_SECRET set, the client IP is forwarded via the private secret-gated header instead', async () => {
  const before = process.env.ADMIN_PROXY_SECRET;
  process.env.ADMIN_PROXY_SECRET = 'shared-secret-value';
  stubFetch();
  await GET(req('/admin/users', { headers: { 'x-forwarded-for': '203.0.113.9' } }), ctx('admin/users'));
  process.env.ADMIN_PROXY_SECRET = before;
  const sentHeaders = new Headers(calls[0].init.headers);
  assert.equal(sentHeaders.get('x-lifewell-client-ip'), '203.0.113.9');
  assert.equal(sentHeaders.get('x-lifewell-proxy-secret'), 'shared-secret-value');
});

test('8c. without ADMIN_PROXY_SECRET set, no client-ip headers are sent at all', async () => {
  const before = process.env.ADMIN_PROXY_SECRET;
  delete process.env.ADMIN_PROXY_SECRET;
  stubFetch();
  await GET(req('/admin/users', { headers: { 'x-forwarded-for': '203.0.113.9' } }), ctx('admin/users'));
  process.env.ADMIN_PROXY_SECRET = before;
  const sentHeaders = new Headers(calls[0].init.headers);
  assert.equal(sentHeaders.has('x-lifewell-client-ip'), false);
  assert.equal(sentHeaders.has('x-lifewell-proxy-secret'), false);
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

test('11. with VERCEL_PROTECTION_BYPASS_SECRET set, the proxy sends x-vercel-protection-bypass upstream (lets this app reach a Deployment-Protected Express preview)', async () => {
  const before = process.env.VERCEL_PROTECTION_BYPASS_SECRET;
  process.env.VERCEL_PROTECTION_BYPASS_SECRET = 'bypass-secret-value';
  stubFetch();
  await GET(req('/admin/users'), ctx('admin/users'));
  process.env.VERCEL_PROTECTION_BYPASS_SECRET = before;
  const sentHeaders = new Headers(calls[0].init.headers);
  assert.equal(sentHeaders.get('x-vercel-protection-bypass'), 'bypass-secret-value');
});

test('12. without VERCEL_PROTECTION_BYPASS_SECRET set, no bypass header is sent (production\'s unprotected API needs none)', async () => {
  const before = process.env.VERCEL_PROTECTION_BYPASS_SECRET;
  delete process.env.VERCEL_PROTECTION_BYPASS_SECRET;
  stubFetch();
  await GET(req('/admin/users'), ctx('admin/users'));
  process.env.VERCEL_PROTECTION_BYPASS_SECRET = before;
  const sentHeaders = new Headers(calls[0].init.headers);
  assert.equal(sentHeaders.has('x-vercel-protection-bypass'), false);
});

/* --------------------------------------- Phase 1 item 4: idle timeout --- */

function getCookie(response, name) {
  const all = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get('set-cookie')];
  return all.find((c) => c && c.startsWith(`${name}=`));
}

test('13. a successful authenticated call refreshes the session cookie with a fresh ~30-minute Max-Age (API-only activity resets the idle clock, since middleware never runs for /api/*)', async () => {
  stubFetch();
  const response = await GET(req('/admin/users', { cookie: 'my-token' }), ctx('admin/users'));
  const cookie = getCookie(response, SESSION_COOKIE);
  assert.ok(cookie);
  assert.match(cookie, /my-token/);
  const maxAgeMatch = cookie.match(/Max-Age=(\d+)/i);
  assert.equal(Number(maxAgeMatch[1]), 60 * 30);
});

test('14. a request with no session cookie gets no cookie refresh (nothing to slide)', async () => {
  stubFetch();
  const response = await GET(req('/admin/users'), ctx('admin/users'));
  assert.equal(getCookie(response, SESSION_COOKIE), undefined);
});

test('15. a 401 from upstream (expired/revoked session) does NOT refresh the cookie — extending an already-invalid session would be pointless', async () => {
  stubFetch(() => new Response(JSON.stringify({ success: false }), { status: 401 }));
  const response = await GET(req('/admin/users', { cookie: 'stale-token' }), ctx('admin/users'));
  assert.equal(getCookie(response, SESSION_COOKIE), undefined);
});
