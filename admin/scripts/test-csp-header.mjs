/**
 * Regression tests for the nonce-based Content-Security-Policy-Report-Only
 * header (P4-G3D), generated per-request in admin/src/middleware.ts.
 *
 * Calls the actual `middleware()` function Next.js invokes per request, so
 * this is testing the real implementation, not a copy of it. The forwarded
 * request CSP is recovered via the x-middleware-request-* encoding that
 * NextResponse.next({ request: { headers } }) actually produces (see
 * next/dist/server/web/spec-extension/response.js in the installed
 * package) — that's the real mechanism Next's SSR nonce parser reads from,
 * not a re-implementation of it.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-csp-header.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server';
import { middleware, config } from '../src/middleware.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

const nextConfigSource = readFileSync(join(root, 'next.config.js'), 'utf8');
const middlewareSource = readFileSync(join(root, 'src', 'middleware.ts'), 'utf8');
const layoutSource = readFileSync(join(root, 'src', 'app', 'layout.tsx'), 'utf8');
const cspReportSource = readFileSync(join(root, 'src', 'app', 'api', 'csp-report', 'route.ts'), 'utf8');

function invoke(path = '/login', env = {}) {
  const before = { ...process.env };
  Object.assign(process.env, env);
  const request = new NextRequest(`https://lifewellfhp-admin.vercel.app${path}`);
  const response = middleware(request);
  process.env = before;
  return response;
}

function responseCsp(response) {
  return response.headers.get('Content-Security-Policy-Report-Only');
}

function requestCsp(response) {
  return response.headers.get('x-middleware-request-content-security-policy-report-only');
}

function directive(csp, name) {
  return csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
}

function extractNonce(csp) {
  const scriptSrc = directive(csp, 'script-src');
  const match = scriptSrc && scriptSrc.match(/'nonce-([A-Za-z0-9+/_-]+={0,2})'/);
  return match ? match[1] : null;
}

test('A. the header key is Content-Security-Policy-Report-Only, and the enforced key is absent', () => {
  const response = invoke();
  assert.ok(responseCsp(response), 'Report-Only header must be present');
  assert.equal(response.headers.get('Content-Security-Policy'), null, 'enforced CSP must never be set');
});

test('B. middleware.ts source never calls .set() with the enforced Content-Security-Policy key (only the Report-Only key)', () => {
  // Matches only an actual .set('Content-Security-Policy', ...) call — the
  // closing quote must immediately follow "Policy", so this cannot match
  // 'Content-Security-Policy-Report-Only' or a prose comment.
  const setCalls = middlewareSource.match(/\.set\(\s*'Content-Security-Policy'\s*,/g) || [];
  assert.equal(setCalls.length, 0);
});

test('C. next.config.js no longer constructs or emits any CSP header', () => {
  assert.doesNotMatch(nextConfigSource, /Content-Security-Policy/);
  assert.doesNotMatch(nextConfigSource, /cspReportOnly/);
});

test('D. every middleware invocation generates a nonce', () => {
  const nonce = extractNonce(responseCsp(invoke()));
  assert.ok(nonce, 'script-src must contain a nonce token');
});

test('E. two independent invocations generate different nonces', () => {
  const n1 = extractNonce(responseCsp(invoke()));
  const n2 = extractNonce(responseCsp(invoke()));
  assert.notEqual(n1, n2);
});

test('F. the nonce matches the exact format the installed Next.js parser accepts (CSP_NONCE_SOURCE_REGEX)', () => {
  const nonce = extractNonce(responseCsp(invoke()));
  assert.match(nonce, /^[A-Za-z0-9+/_-]+={0,2}$/);
});

test('G. the SAME nonce appears in the forwarded request CSP and the response CSP', () => {
  const response = invoke();
  const reqNonce = extractNonce(requestCsp(response));
  const resNonce = extractNonce(responseCsp(response));
  assert.ok(reqNonce, 'forwarded request CSP must be present and contain a nonce');
  assert.equal(reqNonce, resNonce);
});

test('H. script-src contains the nonce and strict-dynamic, and does not contain unsafe-inline or unsafe-eval', () => {
  const csp = responseCsp(invoke());
  const nonce = extractNonce(csp);
  const scriptSrc = directive(csp, 'script-src');
  assert.match(scriptSrc, new RegExp(`'nonce-${nonce}'`));
  assert.match(scriptSrc, /'strict-dynamic'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
});

test('I. style-src remains self + unsafe-inline (intentional — documented React inline styles)', () => {
  const csp = responseCsp(invoke());
  assert.equal(directive(csp, 'style-src'), "style-src 'self' 'unsafe-inline'");
});

test('J. img-src is unchanged', () => {
  const csp = responseCsp(invoke());
  assert.equal(directive(csp, 'img-src'), "img-src 'self' https: data: blob:");
});

test('K. connect-src is unchanged (default fallback)', () => {
  const csp = responseCsp(invoke());
  assert.equal(directive(csp, 'connect-src'), "connect-src 'self' https://lifewellfhp-server.vercel.app");
});

test('K2. connect-src follows NEXT_PUBLIC_API_URL when overridden', () => {
  const csp = responseCsp(invoke('/login', { NEXT_PUBLIC_API_URL: 'https://example-preview.vercel.app' }));
  assert.equal(directive(csp, 'connect-src'), 'connect-src \'self\' https://example-preview.vercel.app');
});

test('L. YouTube remains allowed in frame-src', () => {
  const csp = responseCsp(invoke());
  assert.match(directive(csp, 'frame-src'), /https:\/\/www\.youtube-nocookie\.com/);
});

test('M. Vimeo remains allowed in frame-src', () => {
  const csp = responseCsp(invoke());
  assert.match(directive(csp, 'frame-src'), /https:\/\/player\.vimeo\.com/);
});

test('N. frame-ancestors remains none', () => {
  const csp = responseCsp(invoke());
  assert.equal(directive(csp, 'frame-ancestors'), "frame-ancestors 'none'");
});

test('O. object-src remains none', () => {
  const csp = responseCsp(invoke());
  assert.equal(directive(csp, 'object-src'), "object-src 'none'");
});

test('P. base-uri remains self', () => {
  const csp = responseCsp(invoke());
  assert.equal(directive(csp, 'base-uri'), "base-uri 'self'");
});

test('Q. form-action remains self', () => {
  const csp = responseCsp(invoke());
  assert.equal(directive(csp, 'form-action'), "form-action 'self'");
});

test('R. report-uri remains /api/csp-report', () => {
  const csp = responseCsp(invoke());
  assert.equal(directive(csp, 'report-uri'), 'report-uri /api/csp-report');
});

test('S. the nonce is never logged, persisted outside the request/response, or placed in cookies/storage', () => {
  assert.doesNotMatch(middlewareSource, /console\.|logger\./);
  assert.doesNotMatch(middlewareSource, /\.cookies\.set/);
  assert.doesNotMatch(middlewareSource, /localStorage|sessionStorage/);
  assert.doesNotMatch(middlewareSource, /supabase|\.from\(/i);
});

test('T. nonce generation uses Web Crypto (getRandomValues), never Math.random, and is not derived from the URL/timestamp/IP/cookies', () => {
  assert.match(middlewareSource, /crypto\.getRandomValues/);
  assert.doesNotMatch(middlewareSource, /Math\.random/);
  assert.doesNotMatch(middlewareSource, /request\.ip|request\.cookies|request\.nextUrl|Date\.now\(\)/);
});

test('U. the root layout forces dynamic rendering (required for per-request nonce correctness)', () => {
  assert.match(layoutSource, /export const dynamic = 'force-dynamic';/);
});

test('V. the middleware matcher covers page paths and excludes /api, /_next/static, /_next/image, favicon.ico', () => {
  assert.equal(config.matcher.length, 1);
  assert.match(config.matcher[0], /\(\?!api\|_next\/static\|_next\/image\|favicon\.ico\)/);
});

test('W. existing non-CSP security headers in next.config.js are unchanged, and next.config.js sets no CSP', async () => {
  delete require.cache[require.resolve(join(root, 'next.config.js'))];
  const nextConfig = require(join(root, 'next.config.js'));
  const rules = await nextConfig.headers();
  const byKey = Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
  assert.equal(byKey['X-Content-Type-Options'], 'nosniff');
  assert.equal(byKey['X-Frame-Options'], 'DENY');
  assert.equal(byKey['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(byKey['Permissions-Policy'], 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  assert.equal(byKey['Content-Security-Policy-Report-Only'], undefined);
  assert.equal(byKey['Content-Security-Policy'], undefined);
});

test('X. the CSP report endpoint is unchanged (still force-dynamic, still allowlist-only field extraction)', () => {
  assert.match(cspReportSource, /export const dynamic = 'force-dynamic';/);
  assert.match(cspReportSource, /documentUri:/);
  assert.match(cspReportSource, /blockedUri:/);
});
