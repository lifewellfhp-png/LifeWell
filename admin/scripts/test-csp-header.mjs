/**
 * Regression tests for the nonce-based, enforced Content-Security-Policy
 * header (P4-G3F — Stage 5 of the P4-G3C design), generated per-request in
 * admin/src/middleware.ts.
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
import { readFileSync, existsSync } from 'node:fs';
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

function enforcedCsp(response) {
  return response.headers.get('Content-Security-Policy');
}

function requestCsp(response) {
  return response.headers.get('x-middleware-request-content-security-policy');
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

test('1/2. the enforced Content-Security-Policy header is emitted, and Content-Security-Policy-Report-Only is absent', () => {
  const response = invoke();
  assert.ok(enforcedCsp(response), 'enforced CSP header must be present');
  assert.equal(
    response.headers.get('Content-Security-Policy-Report-Only'),
    null,
    'Report-Only key must not be emitted alongside the enforced key'
  );
});

test('B. middleware.ts source sets only the enforced Content-Security-Policy key, never the Report-Only key', () => {
  // The Report-Only key must not appear anywhere in the source at all —
  // this file must not silently keep both.
  assert.doesNotMatch(middlewareSource, /Content-Security-Policy-Report-Only/);
  const enforcedSetCalls = middlewareSource.match(/\.set\(\s*'Content-Security-Policy'\s*,/g) || [];
  assert.equal(enforcedSetCalls.length, 2, 'expected exactly two .set() calls: request headers + response headers');
});

test('3. every middleware invocation generates a nonce', () => {
  const nonce = extractNonce(enforcedCsp(invoke()));
  assert.ok(nonce, 'script-src must contain a nonce token');
});

test('4. two independent invocations generate different nonces', () => {
  const n1 = extractNonce(enforcedCsp(invoke()));
  const n2 = extractNonce(enforcedCsp(invoke()));
  assert.notEqual(n1, n2);
});

test('F. the nonce matches the exact format the installed Next.js parser accepts (CSP_NONCE_SOURCE_REGEX)', () => {
  const nonce = extractNonce(enforcedCsp(invoke()));
  assert.match(nonce, /^[A-Za-z0-9+/_-]+={0,2}$/);
});

test('5. the SAME nonce appears in the forwarded request CSP and the response CSP', () => {
  const response = invoke();
  const reqNonce = extractNonce(requestCsp(response));
  const resNonce = extractNonce(enforcedCsp(response));
  assert.ok(reqNonce, 'forwarded request CSP must be present and contain a nonce');
  assert.equal(reqNonce, resNonce);
});

test('6/7/8/9. script-src contains the matching nonce and strict-dynamic, and does not contain unsafe-inline or unsafe-eval', () => {
  const csp = enforcedCsp(invoke());
  const nonce = extractNonce(csp);
  const scriptSrc = directive(csp, 'script-src');
  // Plain substring check, not a RegExp built from the nonce — a base64
  // nonce can contain '+' (a regex quantifier), which broke this exact
  // assertion when a sampled nonce happened to contain one.
  assert.equal(scriptSrc.includes(`'nonce-${nonce}'`), true);
  assert.match(scriptSrc, /'strict-dynamic'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
});

test('10. style-src remains self + unsafe-inline (intentional — documented React inline styles)', () => {
  const csp = enforcedCsp(invoke());
  assert.equal(directive(csp, 'style-src'), "style-src 'self' 'unsafe-inline'");
});

test('11. img-src is unchanged', () => {
  const csp = enforcedCsp(invoke());
  assert.equal(directive(csp, 'img-src'), "img-src 'self' https: data: blob:");
});

test('12. connect-src is unchanged (default fallback)', () => {
  const csp = enforcedCsp(invoke());
  assert.equal(directive(csp, 'connect-src'), "connect-src 'self' https://lifewellfhp-server.vercel.app");
});

test('12b. connect-src follows NEXT_PUBLIC_API_URL when overridden', () => {
  const csp = enforcedCsp(invoke('/login', { NEXT_PUBLIC_API_URL: 'https://example-preview.vercel.app' }));
  assert.equal(directive(csp, 'connect-src'), 'connect-src \'self\' https://example-preview.vercel.app');
});

test('13. YouTube remains allowed in frame-src', () => {
  const csp = enforcedCsp(invoke());
  assert.match(directive(csp, 'frame-src'), /https:\/\/www\.youtube-nocookie\.com/);
});

test('14. Vimeo remains allowed in frame-src', () => {
  const csp = enforcedCsp(invoke());
  assert.match(directive(csp, 'frame-src'), /https:\/\/player\.vimeo\.com/);
});

test('15. frame-ancestors remains none', () => {
  const csp = enforcedCsp(invoke());
  assert.equal(directive(csp, 'frame-ancestors'), "frame-ancestors 'none'");
});

test('16. object-src remains none', () => {
  const csp = enforcedCsp(invoke());
  assert.equal(directive(csp, 'object-src'), "object-src 'none'");
});

test('17. base-uri remains self', () => {
  const csp = enforcedCsp(invoke());
  assert.equal(directive(csp, 'base-uri'), "base-uri 'self'");
});

test('18. form-action remains self', () => {
  const csp = enforcedCsp(invoke());
  assert.equal(directive(csp, 'form-action'), "form-action 'self'");
});

test('19. report-uri remains /api/csp-report', () => {
  const csp = enforcedCsp(invoke());
  assert.equal(directive(csp, 'report-uri'), 'report-uri /api/csp-report');
});

test('20/21/22. the nonce is never logged, persisted outside the request/response, or placed in cookies/storage', () => {
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

test('25. the root layout forces dynamic rendering (required for per-request nonce correctness)', () => {
  assert.match(layoutSource, /export const dynamic = 'force-dynamic';/);
});

test('26/27. the middleware matcher is unchanged and still excludes /api (so /api/csp-report is excluded), /_next/static, /_next/image, favicon.ico', () => {
  assert.equal(config.matcher.length, 1);
  assert.match(config.matcher[0], /\(\?!api\|_next\/static\|_next\/image\|favicon\.ico\)/);
});

test('23/24. next.config.js sets no CSP header, and the other security headers are unchanged', async () => {
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

test('28. the CSP report endpoint is unchanged (still force-dynamic, still allowlist-only field extraction)', () => {
  assert.match(cspReportSource, /export const dynamic = 'force-dynamic';/);
  assert.match(cspReportSource, /documentUri:/);
  assert.match(cspReportSource, /blockedUri:/);
});

test('Y. the Preview-only csp-probe diagnostic fixture never entered main — no such route exists', () => {
  assert.equal(
    existsSync(join(root, 'src', 'app', 'csp-probe')),
    false,
    'admin/src/app/csp-probe must not exist on main — it is a Preview-branch-only fixture (P4-G3E)'
  );
});
