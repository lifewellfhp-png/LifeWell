/**
 * Regression tests for Phase 8 P3-1: privacy-minimized device/referrer
 * attribution on conversion events (client side).
 *
 * Covers:
 *   - classifyDevice() matches trackPageView's own breakpoints exactly (no
 *     divergent classification rule).
 *   - extractReferrerHost() only accepts http(s) referrers, uses .hostname
 *     (never a port), and fails safely (null) for anything else.
 *   - trackConversion() calls both and includes them in the payload for
 *     every conversion type, without ever sending a raw user agent, full
 *     referrer URL, or PII.
 *   - trackPageView's own existing referrer/device capture is unchanged.
 *
 * No live Supabase, no Production credentials, no network call — fetch is
 * stubbed, and window/document are temporarily defined only where a test
 * needs to simulate a browser environment, then restored.
 *
 *   npx tsx --test scripts/test-conversion-attribution.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const cmsSource = readFileSync(join(root, 'src/lib/cms.ts'), 'utf8');

const { classifyDevice, extractReferrerHost, trackConversion, trackPageView } = await import('../src/lib/cms.ts');

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
});

function stubFetch() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  };
  return calls;
}

function fakeMatchMedia(maxWidthMatchedQueries) {
  return (query) => ({ matches: maxWidthMatchedQueries.includes(query) });
}

/* ------------------------------------------------- classifyDevice() --- */

test('1. classifyDevice returns "unknown" outside a browser (no window)', () => {
  assert.equal(classifyDevice(), 'unknown');
});

test('2. classifyDevice returns "mobile" when the mobile breakpoint matches', () => {
  globalThis.window = { matchMedia: fakeMatchMedia(['(max-width: 767px)', '(max-width: 1024px)']) };
  assert.equal(classifyDevice(), 'mobile');
});

test('3. classifyDevice returns "tablet" when only the tablet breakpoint matches', () => {
  globalThis.window = { matchMedia: fakeMatchMedia(['(max-width: 1024px)']) };
  assert.equal(classifyDevice(), 'tablet');
});

test('4. classifyDevice returns "desktop" when neither breakpoint matches', () => {
  globalThis.window = { matchMedia: fakeMatchMedia([]) };
  assert.equal(classifyDevice(), 'desktop');
});

test('5. classifyDevice uses the exact same breakpoints as trackPageView (no divergent rule)', () => {
  const classifyBlock = cmsSource.slice(cmsSource.indexOf('export function classifyDevice'), cmsSource.indexOf('export function extractReferrerHost'));
  assert.match(classifyBlock, /\(max-width: 767px\)/);
  assert.match(classifyBlock, /\(max-width: 1024px\)/);
  // trackPageView must call the shared function, not keep its own inline copy.
  const trackPageViewBlock = cmsSource.slice(cmsSource.indexOf('export async function trackPageView'));
  assert.match(trackPageViewBlock, /const device = classifyDevice\(\);/);
  assert.doesNotMatch(trackPageViewBlock, /window\.matchMedia/, 'trackPageView must not keep its own duplicate breakpoint logic');
});

/* ---------------------------------------------- extractReferrerHost() --- */

test('6. extractReferrerHost returns null outside a browser (no document)', () => {
  assert.equal(extractReferrerHost(), null);
});

test('7. extractReferrerHost returns null when there is no referrer', () => {
  globalThis.document = { referrer: '' };
  assert.equal(extractReferrerHost(), null);
});

test('8. extractReferrerHost extracts the bare hostname from a valid https referrer', () => {
  globalThis.document = { referrer: 'https://www.google.com/search?q=lifewell' };
  assert.equal(extractReferrerHost(), 'www.google.com');
});

test('9. extractReferrerHost extracts the bare hostname from a valid http referrer', () => {
  globalThis.document = { referrer: 'http://example.com/' };
  assert.equal(extractReferrerHost(), 'example.com');
});

test('10. extractReferrerHost never includes a port (.hostname, not .host)', () => {
  globalThis.document = { referrer: 'https://example.com:8080/page' };
  assert.equal(extractReferrerHost(), 'example.com');
});

test('11. extractReferrerHost rejects non-http(s) schemes (e.g. an in-app browser referrer)', () => {
  globalThis.document = { referrer: 'android-app://com.google.android.googlequicksearchbox/' };
  assert.equal(extractReferrerHost(), null);
});

test('12. extractReferrerHost fails safely (null) on a malformed referrer rather than throwing', () => {
  globalThis.document = { referrer: 'not a url at all' };
  assert.doesNotThrow(() => extractReferrerHost());
  assert.equal(extractReferrerHost(), null);
});

/* --------------------------------------------- trackConversion payload --- */

test('13. trackConversion includes device and referrer_host for every conversion type, computed fresh each call', async () => {
  for (const type of ['contact', 'newsletter', 'booking_click']) {
    const calls = stubFetch();
    await trackConversion(type, '/some-page');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.conversion_type, type);
    assert.ok('device' in body);
    assert.ok('referrer_host' in body);
  }
});

test('14. trackConversion never sends a raw user agent or full referrer URL, only the derived fields', async () => {
  globalThis.document = { referrer: 'https://www.google.com/search?q=depression+treatment+orlando' };
  const calls = stubFetch();
  await trackConversion('booking_click', '/fees-insurance');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.referrer_host, 'www.google.com');
  const flat = JSON.stringify(body);
  assert.ok(!flat.includes('search?q='), 'the full referrer URL/query string must never be sent');
  assert.ok(!flat.includes('depression'), 'no free-text search-term leakage into the payload');
  assert.ok(!('userAgent' in body) && !('user_agent' in body), 'no raw user-agent field');
});

test('15. trackConversion resolves cleanly even if attribution computation itself were to throw', async () => {
  // classifyDevice/extractReferrerHost are pure and should not throw, but
  // trackConversion's own try/catch must still protect navigation even if
  // something upstream (e.g. a hostile matchMedia polyfill) misbehaves.
  globalThis.window = {
    matchMedia() {
      throw new Error('simulated matchMedia failure');
    },
  };
  await assert.doesNotReject(() => trackConversion('booking_click', '/'));
});

/* --------------------------------------------------- trackPageView unchanged --- */

test('16. trackPageView keeps its own existing referrer capture (.host, not .hostname) — unchanged by this task', () => {
  const trackPageViewBlock = cmsSource.slice(
    cmsSource.indexOf('export async function trackPageView'),
    cmsSource.indexOf('export async function trackConversion')
  );
  assert.match(trackPageViewBlock, /new URL\(document\.referrer\)\.host\b/);
  assert.doesNotMatch(trackPageViewBlock, /extractReferrerHost/, 'trackPageView must not be changed to use the new stricter helper');
});

test('17. trackPageView payload shape for device/referrer_host is unaffected by this task — Phase 8 P3-UTM-1 (a later, separately-authorized task) additively appended utm_source/utm_medium/utm_campaign, tested in test-page-view-utm-capture.mjs', async () => {
  const calls = stubFetch();
  globalThis.document = { referrer: '' };
  await trackPageView('/some-page');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(
    Object.keys(body).sort(),
    ['device', 'event_type', 'path', 'referrer_host', 'utm_campaign', 'utm_medium', 'utm_source']
  );
});
