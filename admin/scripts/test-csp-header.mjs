/**
 * Regression tests for the Content-Security-Policy-Report-Only header
 * configured in admin/next.config.js (P4-E4).
 *
 * Calls the actual `headers()` function Next.js uses to generate response
 * headers, so this is testing the real config, not a copy of it.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-csp-header.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

async function getCspValue(env = {}) {
  const before = { ...process.env };
  Object.assign(process.env, env);
  delete require.cache[require.resolve(join(__dirname, '..', 'next.config.js'))];
  const config = require(join(__dirname, '..', 'next.config.js'));
  const rules = await config.headers();
  process.env = before;
  const rule = rules.find((r) => r.source === '/:path*');
  const header = rule.headers.find((h) => h.key === 'Content-Security-Policy-Report-Only');
  return header?.value;
}

test('A. Content-Security-Policy-Report-Only is present on every route', async () => {
  const config = require(join(__dirname, '..', 'next.config.js'));
  const rules = await config.headers();
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, '/:path*');
});

test('B. the policy is Report-Only, not enforcing — no Content-Security-Policy header is set', async () => {
  const config = require(join(__dirname, '..', 'next.config.js'));
  const rules = await config.headers();
  const keys = rules[0].headers.map((h) => h.key);
  assert.ok(keys.includes('Content-Security-Policy-Report-Only'));
  assert.equal(keys.includes('Content-Security-Policy'), false);
});

test('C. existing baseline security headers (P4-B1) are untouched', async () => {
  const config = require(join(__dirname, '..', 'next.config.js'));
  const rules = await config.headers();
  const byKey = Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
  assert.equal(byKey['X-Content-Type-Options'], 'nosniff');
  assert.equal(byKey['X-Frame-Options'], 'DENY');
  assert.equal(byKey['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(byKey['Permissions-Policy'], 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
});

test('D. the report-uri directive points at the same-origin report endpoint', async () => {
  const value = await getCspValue();
  assert.match(value, /report-uri \/api\/csp-report\b/);
});

test('E. connect-src allows the Admin API origin (default fallback)', async () => {
  const value = await getCspValue();
  assert.match(value, /connect-src 'self' https:\/\/lifewellfhp-server\.vercel\.app/);
});

test('F. connect-src follows NEXT_PUBLIC_API_URL when overridden', async () => {
  const value = await getCspValue({ NEXT_PUBLIC_API_URL: 'https://example-preview.vercel.app' });
  assert.match(value, /connect-src 'self' https:\/\/example-preview\.vercel\.app/);
});

test('G. img-src permits staff-managed https images, data:, and blob:', async () => {
  const value = await getCspValue();
  assert.match(value, /img-src 'self' https: data: blob:/);
});

test('H. frame-src permits only the youtube-nocookie.com preview host', async () => {
  const value = await getCspValue();
  assert.match(value, /frame-src https:\/\/www\.youtube-nocookie\.com/);
  assert.doesNotMatch(value, /frame-src[^;]*vimeo/i);
});

test('I. style-src allows unsafe-inline (existing React inline styles) — documented, not silently dropped', () => {
  return getCspValue().then((value) => {
    assert.match(value, /style-src 'self' 'unsafe-inline'/);
  });
});

test('J. no unsafe-eval anywhere in the policy', async () => {
  const value = await getCspValue();
  assert.doesNotMatch(value, /unsafe-eval/);
});

test('K. frame-ancestors none and object-src none are present (hardening, consistent with X-Frame-Options DENY)', async () => {
  const value = await getCspValue();
  assert.match(value, /frame-ancestors 'none'/);
  assert.match(value, /object-src 'none'/);
});

test('L. font-src is self only (next/font self-hosts, no external font host needed)', async () => {
  const value = await getCspValue();
  assert.match(value, /font-src 'self'/);
});
