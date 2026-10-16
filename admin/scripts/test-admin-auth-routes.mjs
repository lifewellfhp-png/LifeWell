/**
 * Regression tests for Phase 1 item 3's dedicated auth route handlers
 * (app/api/admin/auth/{login,logout,change-password}/route.ts) and Phase 1
 * item 5's mfa-verify route — the only places that ever see the raw JWT
 * from Express, and the only places that set/clear the httpOnly session
 * cookie.
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
import { POST as mfaVerify } from '../src/app/api/admin/auth/mfa-verify/route.ts';
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

function logoutRequest(cookie) {
  const headers = cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {};
  return new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/logout', {
    method: 'POST',
    headers,
  });
}

test('4. logout clears the session cookie', async () => {
  stubFetch(async () => new Response('{"success":true}', { status: 200 }));
  const response = await logout(logoutRequest('some-token'));
  const cookie = getCookie(response, SESSION_COOKIE);
  assert.ok(cookie, 'a Set-Cookie clearing the session must be present');
  assert.match(cookie, new RegExp(`${SESSION_COOKIE}=;`));
});

test('4b. logout with a session calls Express to revoke it server-side (token_version bump), forwarding the token as Authorization', async () => {
  let seenUrl, seenHeaders;
  stubFetch(async (url, init) => {
    seenUrl = url;
    seenHeaders = new Headers(init.headers);
    return new Response('{"success":true}', { status: 200 });
  });
  await logout(logoutRequest('real-token-value'));
  assert.match(String(seenUrl), /\/api\/admin\/auth\/logout$/);
  assert.equal(seenHeaders.get('Authorization'), 'Bearer real-token-value');
});

test('4c. logout with NO session cookie never calls Express at all', async () => {
  let called = false;
  stubFetch(async () => {
    called = true;
    return new Response('{"success":true}', { status: 200 });
  });
  const response = await logout(logoutRequest());
  assert.equal(called, false);
  assert.ok(getCookie(response, SESSION_COOKIE), 'the cookie is still cleared even with nothing to revoke');
});

test('4d. logout still clears the local cookie even if the Express revocation call fails (best-effort, never blocks the visible logout)', async () => {
  stubFetch(async () => {
    throw new Error('network down');
  });
  const response = await logout(logoutRequest('some-token'));
  const json = await response.json();
  assert.equal(json.success, true);
  assert.ok(getCookie(response, SESSION_COOKIE));
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

/* ---------------------------------------------- login: MFA passthrough --- */

test('8. a login for an MFA-enabled account passes through mfaRequired/mfaToken without setting a session cookie', async () => {
  stubFetch(async () =>
    new Response(JSON.stringify({ success: true, data: { mfaRequired: true, mfaToken: 'pending-token' } }), {
      status: 200,
    })
  );
  const request = new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
  });
  const response = await login(request);
  const json = await response.json();
  assert.equal(json.data.mfaRequired, true);
  assert.equal(json.data.mfaToken, 'pending-token');
  assert.equal(getCookie(response, SESSION_COOKIE), undefined);
});

/* --------------------------------------------------------- mfa-verify --- */

function mfaVerifyRequest(body) {
  return new NextRequest('https://lifewellfhp-admin.vercel.app/api/admin/auth/mfa-verify', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

test('9. a successful mfa-verify sets the httpOnly session cookie and strips the token from the response body', async () => {
  stubFetch(async () =>
    new Response(
      JSON.stringify({ success: true, data: { token: 'real-jwt-value', user: { id: '1', name: 'A' } } }),
      { status: 200 }
    )
  );
  const response = await mfaVerify(mfaVerifyRequest({ mfa_token: 'pending-token', code: '123456' }));
  const json = await response.json();

  assert.equal(json.success, true);
  assert.equal('token' in (json.data || {}), false, 'token must never appear in the response body');
  assert.deepEqual(json.data.user, { id: '1', name: 'A' });

  const cookie = getCookie(response, SESSION_COOKIE);
  assert.ok(cookie, 'session cookie must be set');
  assert.match(cookie, /real-jwt-value/);
  assert.match(cookie, /HttpOnly/i);
});

test('10. a failed mfa-verify (wrong code) sets no cookie and leaks no token', async () => {
  stubFetch(async () => new Response(JSON.stringify({ success: false, message: 'That code is incorrect.' }), { status: 401 }));
  const response = await mfaVerify(mfaVerifyRequest({ mfa_token: 'pending-token', code: '000000' }));
  const json = await response.json();
  assert.equal(response.status, 401);
  assert.equal(json.success, false);
  assert.equal(getCookie(response, SESSION_COOKIE), undefined);
});

test('11. mfa-verify forwards the request body to Express unchanged (mfa_token + code or recovery_code)', async () => {
  let seenBody;
  stubFetch(async (_url, init) => {
    seenBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ success: false, message: 'nope' }), { status: 401 });
  });
  await mfaVerify(mfaVerifyRequest({ mfa_token: 'pending-token', recovery_code: 'ABCD-1234' }));
  assert.deepEqual(seenBody, { mfa_token: 'pending-token', recovery_code: 'ABCD-1234' });
});

test('12. mfa-verify calls the correct upstream path', async () => {
  let seenUrl;
  stubFetch(async (url) => {
    seenUrl = url;
    return new Response(JSON.stringify({ success: false, message: 'nope' }), { status: 401 });
  });
  await mfaVerify(mfaVerifyRequest({ mfa_token: 'pending-token', code: '123456' }));
  assert.match(String(seenUrl), /\/api\/admin\/auth\/mfa-verify$/);
});
