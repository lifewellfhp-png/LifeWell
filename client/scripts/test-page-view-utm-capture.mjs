/**
 * Regression tests for Phase 8 P3-UTM-1: privacy-safe UTM capture on
 * page_view events (client side).
 *
 * Covers:
 *   - captureUtmParams() reads ONLY utm_source/utm_medium/utm_campaign from
 *     window.location.search — never utm_term/utm_content/gclid/fbclid/any
 *     other parameter, and never the full query string itself.
 *   - trackPageView's payload gains exactly these three additive fields;
 *     path remains pathname-only (never path+search or the full URL);
 *     event_type remains 'page_view'; existing referrer_host/device
 *     capture is untouched.
 *   - Absent UTM params resolve to null, sent consistently (not omitted),
 *     matching the existing referrer_host/device null-when-absent style.
 *   - Internal navigation without UTM params in the URL does NOT inherit
 *     the previous page's values — this file proves EVENT-ONLY behavior by
 *     construction (captureUtmParams re-reads window.location.search fresh
 *     on every call, no module-level or persisted state of any kind).
 *   - trackConversion (booking_click/contact/newsletter) is completely
 *     unchanged — no UTM fields, no capture call.
 *   - No cookie, sessionStorage, or localStorage is introduced anywhere in
 *     this file.
 *
 * No live network call — fetch is stubbed; window/document are temporarily
 * defined only where a test needs to simulate a browser environment, then
 * restored via afterEach.
 *
 *   npx tsx --test scripts/test-page-view-utm-capture.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const cmsSource = readFileSync(join(root, 'src/lib/cms.ts'), 'utf8');

const { trackPageView, trackConversion } = await import('../src/lib/cms.ts');

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

function fakeWindow(search) {
  return { location: { search }, matchMedia: () => ({ matches: false }) };
}

/* ------------------------------------------------- 1-4. capture presence --- */

test('1. a valid utm_source query param is captured', async () => {
  globalThis.window = fakeWindow('?utm_source=google');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.utm_source, 'google');
});

test('2. a valid utm_medium query param is captured', async () => {
  globalThis.window = fakeWindow('?utm_medium=cpc');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.utm_medium, 'cpc');
});

test('3. a valid utm_campaign query param is captured', async () => {
  globalThis.window = fakeWindow('?utm_campaign=florida-psychiatry');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.utm_campaign, 'florida-psychiatry');
});

test('4. all three UTM params are captured together', async () => {
  globalThis.window = fakeWindow('?utm_source=google&utm_medium=cpc&utm_campaign=florida-psychiatry');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.utm_source, 'google');
  assert.equal(body.utm_medium, 'cpc');
  assert.equal(body.utm_campaign, 'florida-psychiatry');
});

/* ------------------------------------------------- 5. absent values --- */

test('5. absent UTM params resolve to null, sent consistently (not omitted) — matches referrer_host/device style', async () => {
  globalThis.window = fakeWindow('');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.utm_source, null);
  assert.equal(body.utm_medium, null);
  assert.equal(body.utm_campaign, null);
  assert.ok('utm_source' in body && 'utm_medium' in body && 'utm_campaign' in body);
});

/* ------------------------------------------------- 6-10. non-UTM params ignored --- */

test('6. non-UTM query parameters are ignored', async () => {
  globalThis.window = fakeWindow('?foo=bar&utm_source=google');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.utm_source, 'google');
  assert.ok(!('foo' in body));
});

test('7. utm_term is ignored', async () => {
  globalThis.window = fakeWindow('?utm_term=depression+treatment');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.ok(!('utm_term' in body));
});

test('8. utm_content is ignored', async () => {
  globalThis.window = fakeWindow('?utm_content=banner1');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.ok(!('utm_content' in body));
});

test('9. gclid is ignored', async () => {
  globalThis.window = fakeWindow('?gclid=abc123');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.ok(!('gclid' in body));
});

test('10. fbclid is ignored', async () => {
  globalThis.window = fakeWindow('?fbclid=xyz789');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.ok(!('fbclid' in body));
});

test('10b. msclkid and other identifier-shaped params are ignored', async () => {
  globalThis.window = fakeWindow('?msclkid=q1w2e3&contact_id=abc&patient_id=def');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.ok(!('msclkid' in body) && !('contact_id' in body) && !('patient_id' in body));
});

/* ------------------------------------------------- 11-12. path/query separation --- */

test('11. path remains pathname only — the query string is never sent as/appended to path', async () => {
  globalThis.window = fakeWindow('?utm_source=google&utm_medium=cpc');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/fees-insurance');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.path, '/fees-insurance');
  assert.ok(!body.path.includes('?'), 'path must never include a query string');
});

test('12. the full query string is never present anywhere in the sent payload', async () => {
  globalThis.window = fakeWindow('?utm_source=google&utm_medium=cpc&utm_campaign=florida-psychiatry&secret=xyz');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  const flat = JSON.stringify(body);
  assert.ok(!flat.includes('secret=xyz'), 'no non-UTM param may leak into the payload');
  assert.ok(!flat.includes('?utm_source=google&utm_medium=cpc'), 'the raw query string itself must never be sent verbatim');
});

/* ------------------------------------------------- 13. event-only behavior --- */

test('13. internal navigation without UTM params does not inherit a prior page\'s UTM values (event-only, no persistence)', async () => {
  // First "page load" carries UTMs.
  globalThis.window = fakeWindow('?utm_source=google&utm_medium=cpc&utm_campaign=florida-psychiatry');
  globalThis.document = { referrer: '' };
  let calls = stubFetch();
  await trackPageView('/');
  let body = JSON.parse(calls[0].init.body);
  assert.equal(body.utm_source, 'google');

  // Second call simulates an internal SPA navigation to a URL with no UTM
  // params — captureUtmParams reads window.location.search fresh every
  // call, with no module-level variable carrying the prior values forward.
  globalThis.window = fakeWindow('');
  calls = stubFetch();
  await trackPageView('/fees-insurance');
  body = JSON.parse(calls[0].init.body);
  assert.equal(body.path, '/fees-insurance');
  assert.equal(body.utm_source, null);
  assert.equal(body.utm_medium, null);
  assert.equal(body.utm_campaign, null);
});

test('13b. no module-level/persisted UTM state exists in cms.ts — source-level guarantee behind the behavioral test above', () => {
  assert.doesNotMatch(cmsSource, /let\s+(lastUtm|storedUtm|persistedUtm|currentUtm)/i);
  assert.doesNotMatch(cmsSource, /localStorage/);
  assert.doesNotMatch(cmsSource, /sessionStorage/);
  assert.doesNotMatch(cmsSource, /document\.cookie/);
});

/* ------------------------------------------------- 14. event_type unchanged --- */

test('14. event_type remains "page_view", unaffected by UTM capture', async () => {
  globalThis.window = fakeWindow('?utm_source=google');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.event_type, 'page_view');
});

/* ------------------------------------------------- 15-16. referrer/device unchanged --- */

test('15. existing referrer_host capture is unaffected by UTM capture', async () => {
  globalThis.window = fakeWindow('?utm_source=google');
  globalThis.document = { referrer: 'https://www.google.com/search?q=lifewell' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.referrer_host, 'www.google.com');
});

test('16. existing device capture is unaffected by UTM capture', async () => {
  globalThis.window = { location: { search: '?utm_source=google' }, matchMedia: (q) => ({ matches: q === '(max-width: 767px)' }) };
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackPageView('/');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.device, 'mobile');
});

/* ------------------------------------------------- 17-19. conversion protection --- */

test('17. trackConversion (booking_click) payload gains no UTM fields', async () => {
  globalThis.window = fakeWindow('?utm_source=google');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackConversion('booking_click', '/');
  const body = JSON.parse(calls[0].init.body);
  assert.ok(!('utm_source' in body) && !('utm_medium' in body) && !('utm_campaign' in body));
});

test('18. trackConversion (contact) payload gains no UTM fields', async () => {
  globalThis.window = fakeWindow('?utm_source=google');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await trackConversion('contact', '/contact-telehealth-mental-health-provider');
  const body = JSON.parse(calls[0].init.body);
  assert.ok(!('utm_source' in body) && !('utm_medium' in body) && !('utm_campaign' in body));
});

test('19. trackConversion source is completely unchanged by this task', () => {
  const conversionFnStart = cmsSource.indexOf('export async function trackConversion');
  const conversionFnBody = cmsSource.slice(conversionFnStart);
  assert.doesNotMatch(conversionFnBody, /utm_source|utm_medium|utm_campaign|captureUtmParams/);
});

/* ------------------------------------------------- 20. no browser storage/cookie --- */

test('20. no cookie, sessionStorage, or localStorage is introduced anywhere in cms.ts', () => {
  assert.doesNotMatch(cmsSource, /localStorage/);
  assert.doesNotMatch(cmsSource, /sessionStorage/);
  assert.doesNotMatch(cmsSource, /document\.cookie/);
});

test('21. captureUtmParams reads only the three allowed keys, via URLSearchParams, never the raw search string as a whole', () => {
  const fnStart = cmsSource.indexOf('function captureUtmParams');
  const fnBody = cmsSource.slice(fnStart, cmsSource.indexOf('\n}', fnStart));
  assert.match(fnBody, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(fnBody, /read\('utm_source'\)/);
  assert.match(fnBody, /read\('utm_medium'\)/);
  assert.match(fnBody, /read\('utm_campaign'\)/);
  for (const forbidden of ['utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid']) {
    assert.doesNotMatch(fnBody, new RegExp(forbidden));
  }
});

test('22. trackPageView resolves cleanly with all-null UTM values outside a browser environment (no window), never throws', async () => {
  delete globalThis.window;
  assert.equal(typeof window, 'undefined');
  globalThis.document = { referrer: '' };
  const calls = stubFetch();
  await assert.doesNotReject(() => trackPageView('/'));
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.utm_source, null);
  assert.equal(body.utm_medium, null);
  assert.equal(body.utm_campaign, null);
});
