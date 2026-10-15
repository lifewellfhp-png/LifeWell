/**
 * Regression tests for Phase 1 item 3's three dedicated auth route handlers
 * (app/api/admin/auth/{login,logout,change-password}/route.ts) — the only
 * places that ever see the raw JWT from Express, and the only places that
 * set/clear the httpOnly session cookie.
 *
 * globalThis.fetch is stubbed — no real network call is ever made, and
 * nothing hits the real Express API or Supabase.
 *
 *   npx tsx --test scripts/test-admin-auth-routes.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as login } from '../src/app/api/admin/auth/login/route.ts';
import { POST as logout } from '../src/app/api/admin/auth/logout/route.ts';
import { POST as changePassword } from '../src/app/api/admin/auth/change-password/route.ts';
import { SESSION_COOKIE } from '../src/lib/session.ts';

const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(impl) {
  globalThis.fetch = async (url, init) => impl(url, init);
}

function getCookie(response, name) {
  // Node's fetch Headers.getSetCookie() is the only reliable way to read
  // multiple Set-Cookie values; NextResponse exposes the same underlying
  // Headers object.
  const all = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get('set-cookie')];
  return all.find((c) => c && c.startsWith(`${name}=`));
}

/* -------------------------------------------------------------- login --- */

test('1. a successful login sets the httpOnly session cookie and strips the token from the response body', async () => {
  stubFetch(async () =>
    new Response(
      JSON.stringify({ success: true, data: { token: 'real-jwt-value', user: { id: '1', name: 'A' } } }),
      { status: 200 }
    )
  );
  const request = new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
  });
  const response = await login(request);
  const json = await response.json();

  assert.equal(json.success, true);
  assert.equal('token' in (json.data || {}), false, 'token must never appear in the response body');
  assert.deepEqual(json.data.user, { id: '1', name: 'A' });

  const cookie = getCookie(response, SESSION_COOKIE);
  assert.ok(cookie, 'session cookie must be set');
  assert.match(cookie, /real-jwt-value/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=strict/i);
});

test('2. a failed login (bad credentials) sets no cookie and leaks no token', async () => {
  stubFetch(async () =>
    new Response(JSON.stringify({ success: false, message: 'Invalid email or password.' }), { status: 401 })
  );
  const request = new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
  });
  const response = await login(request);
  const json = await response.json();

  assert.equal(response.status, 401);
  assert.equal(json.success, false);
  assert.equal(getCookie(response, SESSION_COOKIE), undefined);
});

test('3. login never forwards the raw x-forwarded-for header upstream', async () => {
  let seenHeaders;
  stubFetch(async (_url, init) => {
    seenHeaders = new Headers(init.headers);
    return new Response(JSON.stringify({ success: false, message: 'nope' }), { status: 401 });
  });
  const request = new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/login', {
    method: 'POST',
    headers: { 'x-forwarded-for': '198.51.100.4' },
    body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
  });
  await login(request);
  assert.equal(seenHeaders.has('x-forwarded-for'), false);
});

test('3b. with ADMIN_PROXY_SECRET set, login forwards the client IP via the private secret-gated header instead (adminLoginLimiter is IP-keyed)', async () => {
  const before = process.env.ADMIN_PROXY_SECRET;
  process.env.ADMIN_PROXY_SECRET = 'shared-secret-value';
  let seenHeaders;
  stubFetch(async (_url, init) => {
    seenHeaders = new Headers(init.headers);
    return new Response(JSON.stringify({ success: false, message: 'nope' }), { status: 401 });
  });
  const request = new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/login', {
    method: 'POST',
    headers: { 'x-forwarded-for': '198.51.100.4' },
    body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
  });
  await login(request);
  process.env.ADMIN_PROXY_SECRET = before;
  assert.equal(seenHeaders.get('x-lifewell-client-ip'), '198.51.100.4');
  assert.equal(seenHeaders.get('x-lifewell-proxy-secret'), 'shared-secret-value');
});

/* ------------------------------------------------------------- logout --- */

test('4. logout clears the session cookie', async () => {
  const response = await logout();
  const cookie = getCookie(response, SESSION_COOKIE);
  assert.ok(cookie, 'a Set-Cookie clearing the session must be present');
  assert.match(cookie, new RegExp(`${SESSION_COOKIE}=;`));
});

/* --------------------------------------------------- change-password --- */

test('5. change-password with no session cookie is rejected without calling upstream', async () => {
  let called = false;
  stubFetch(async () => {
    called = true;
    return new Response('{}', { status: 200 });
  });
  const request = new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: 'a', new_password: 'b' }),
  });
  const response = await changePassword(request);
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test('6. a successful change-password replaces the session cookie with the fresh token', async () => {
  stubFetch(async () => new Response(JSON.stringify({ success: true, data: { token: 'new-jwt' } }), { status: 200 }));
  const request = new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/change-password', {
    method: 'POST',
    headers: { cookie: `${SESSION_COOKIE}=old-jwt` },
    body: JSON.stringify({ current_password: 'a', new_password: 'b' }),
  });
  const response = await changePassword(request);
  const json = await response.json();

  assert.equal(json.success, true);
  assert.equal('token' in (json.data || {}), false, 'token must never appear in the response body');
  const cookie = getCookie(response, SESSION_COOKIE);
  assert.match(cookie, /new-jwt/);
});

test('7. a failed change-password does not replace the cookie', async () => {
  stubFetch(async () =>
    new Response(JSON.stringify({ success: false, message: 'Current password is incorrect.' }), { status: 401 })
  );
  const request = new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/change-password', {
    method: 'POST',
    headers: { cookie: `${SESSION_COOKIE}=old-jwt` },
    body: JSON.stringify({ current_password: 'wrong', new_password: 'b' }),
  });
  const response = await changePassword(request);
  assert.equal(response.status, 401);
  assert.equal(getCookie(response, SESSION_COOKIE), undefined);
});
