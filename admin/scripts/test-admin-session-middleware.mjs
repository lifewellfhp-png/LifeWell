/**
 * Regression tests for Phase 1 item 3's admin session gate in
 * admin/src/middleware.ts: "verify the session in admin middleware before
 * rendering any page except /login." Previously this middleware only set
 * CSP headers — auth was a client-side redirect in AdminShell.tsx, which an
 * unauthenticated request for the page HTML itself never had to pass.
 *
 * Covers the middleware's own JWT verification (signature + expiry only —
 * no token_version/revocation check, which stays the API layer's job via
 * requireAdmin on every real data request through the proxy). Uses jose's
 * SignJWT to mint fixture tokens with the same algorithm/secret shape the
 * real login flow produces (server/src/middleware/adminAuth.ts's
 * signAdminToken), without needing a live Supabase connection.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-admin-session-middleware.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { middleware } from '../src/middleware.ts';
import { SESSION_COOKIE } from '../src/lib/session.ts';

const SECRET = 'test-secret-at-least-32-characters-long';
const encodedSecret = new TextEncoder().encode(SECRET);

async function signToken(payload, { secret = SECRET, expiresIn = '30d', alreadyExpired = false } = {}) {
  const key = secret === SECRET ? encodedSecret : new TextEncoder().encode(secret);
  const jwt = new SignJWT(payload).setProtectedHeader({ alg: 'HS256' });
  if (alreadyExpired) {
    jwt.setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 40).setExpirationTime(
      Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 10
    );
  } else {
    jwt.setIssuedAt().setExpirationTime(expiresIn);
  }
  return jwt.sign(key);
}

async function invoke(path, { cookie, env = {} } = {}) {
  const before = { ...process.env };
  Object.assign(process.env, { ADMIN_JWT_SECRET: SECRET, ...env });
  const init = cookie ? { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } } : undefined;
  const request = new NextRequest(`https://lifewellfhp-admin.vercel.app${path}`, init);
  const response = await middleware(request);
  process.env = before;
  return response;
}

const VALID_PAYLOAD = { sub: 'user-1', email: 'admin@example.com', role: 'super_admin', permissions: ['*'], tv: 0 };

test('1. no cookie on a protected path redirects to /login', async () => {
  const response = await invoke('/leads');
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location')).pathname, '/login');
});

test('2. /login itself is reachable with no cookie at all (never redirected)', async () => {
  const response = await invoke('/login');
  assert.notEqual(response.status, 307);
  assert.equal(response.headers.get('location'), null);
});

test('3. a validly signed, unexpired token is NOT redirected', async () => {
  const token = await signToken(VALID_PAYLOAD);
  const response = await invoke('/leads', { cookie: token });
  assert.equal(response.headers.get('location'), null);
});

test('4. an expired token is redirected to /login', async () => {
  const token = await signToken(VALID_PAYLOAD, { alreadyExpired: true });
  const response = await invoke('/leads', { cookie: token });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location')).pathname, '/login');
});

test('5. a token signed with the WRONG secret is redirected (signature mismatch)', async () => {
  const token = await signToken(VALID_PAYLOAD, { secret: 'a-completely-different-secret-value-here' });
  const response = await invoke('/leads', { cookie: token });
  assert.equal(response.status, 307);
});

test('6. a malformed cookie value (not a JWT at all) is redirected', async () => {
  const response = await invoke('/leads', { cookie: 'not-a-real-token' });
  assert.equal(response.status, 307);
});

test('7. missing ADMIN_JWT_SECRET fails closed — a request is still redirected even with an otherwise-valid-looking token', async () => {
  const token = await signToken(VALID_PAYLOAD);
  const response = await invoke('/leads', { cookie: token, env: { ADMIN_JWT_SECRET: '' } });
  assert.equal(response.status, 307);
});

test('8. an authenticated response still carries the CSP header (the session check never skips it)', async () => {
  const token = await signToken(VALID_PAYLOAD);
  const response = await invoke('/leads', { cookie: token });
  assert.ok(response.headers.get('Content-Security-Policy'));
});

test('9. the redirect response also carries a CSP header, not just successful loads', async () => {
  const response = await invoke('/leads');
  assert.ok(response.headers.get('Content-Security-Policy'));
});

test('10. a sub-path of /login (e.g. a hypothetical /login/reset) is also treated as public', async () => {
  const response = await invoke('/login/reset');
  assert.notEqual(response.status, 307);
});

test('11. the check rejects an algorithm other than HS256 (defense against algorithm-confusion)', async () => {
  // jose's SignJWT with HS256 is all this suite forges elsewhere; this just
  // confirms the verify call itself is pinned, by reading the source rather
  // than forging an alg:none/RS256 token (jose refuses to even construct
  // those against an HMAC key, which is itself a safety property).
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(__dirname, '..', 'src', 'middleware.ts'), 'utf8');
  assert.match(src, /algorithms:\s*\['HS256'\]/);
});

/* --------------------------------------- Phase 1 item 4: idle timeout --- */

function getCookie(response, name) {
  const all = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get('set-cookie')];
  return all.find((c) => c && c.startsWith(`${name}=`));
}

test('12. a valid session on a protected page gets its cookie refreshed with a fresh ~30-minute Max-Age (idle timeout slide)', async () => {
  const token = await signToken(VALID_PAYLOAD);
  const response = await invoke('/leads', { cookie: token });
  const cookie = getCookie(response, SESSION_COOKIE);
  assert.ok(cookie, 'the cookie must be re-set on a successful page load');
  assert.match(cookie, new RegExp(`${SESSION_COOKIE}=${token}`), 'the SAME token is re-sent, never re-signed');
  const maxAgeMatch = cookie.match(/Max-Age=(\d+)/i);
  assert.ok(maxAgeMatch, 'Max-Age must be present');
  assert.equal(Number(maxAgeMatch[1]), 60 * 30);
});

test('13. /login itself never gets a session-cookie refresh (nothing valid to slide)', async () => {
  const response = await invoke('/login');
  assert.equal(getCookie(response, SESSION_COOKIE), undefined);
});

test('14. the redirect-to-login response (invalid/expired session) never refreshes a cookie either', async () => {
  const token = await signToken(VALID_PAYLOAD, { alreadyExpired: true });
  const response = await invoke('/leads', { cookie: token });
  assert.equal(response.status, 307);
  assert.equal(getCookie(response, SESSION_COOKIE), undefined);
});
