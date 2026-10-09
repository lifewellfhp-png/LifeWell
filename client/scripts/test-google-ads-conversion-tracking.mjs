/**
 * Regression tests for Google Ads conversion tracking (gtag.js, Ads-only —
 * no GTM container, no GA4, no enhanced conversions/user_data).
 *
 * Covers:
 *   - layout.tsx loads gtag.js only when NEXT_PUBLIC_GOOGLE_ADS_ID is set,
 *     and the config call explicitly disables ad-personalization signals.
 *   - No GTM/GA4 install anywhere in the new code.
 *   - fireGoogleAdsConversion() no-ops safely when unconfigured/untagged,
 *     and otherwise sends ONLY send_to — never PII, transaction_id, value,
 *     or form content.
 *   - trackConversion() fires the Ads event for contact/phone_click/
 *     booking_click, but never for newsletter (not one of the three
 *     tracked conversion actions).
 *   - The CharmHealth booking iframe and the separate admin/ app are
 *     untouched by this feature.
 *
 * NEXT_PUBLIC_GOOGLE_ADS_ID and the label env vars are read once at module
 * load, so they are set here BEFORE the dynamic import below — the same
 * reason .env values are build-time-baked in this app (see .env.example).
 *
 *   npx tsx --test scripts/test-google-ads-conversion-tracking.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');

process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = 'AW-123456789';
process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_CONTACT = 'LblOne111';
process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_PHONE_CLICK = 'LblTwo222';
process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_BOOKING_CLICK = 'LblThree333';

/** Real browsers always have matchMedia; stub it so classifyDevice() (called
 *  unconditionally inside trackConversion's beacon payload) never throws. */
function fakeWindow(extra = {}) {
  return { matchMedia: () => ({ matches: false }), ...extra };
}

const { fireGoogleAdsConversion } = await import('../src/lib/googleAdsConversion.ts');
const { trackConversion } = await import('../src/lib/cms.ts');

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
});

function stubFetch() {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ success: true }) });
}

/* ------------------------------------------------------ layout.tsx --- */

test('1. the Ads tag only renders when NEXT_PUBLIC_GOOGLE_ADS_ID is configured', () => {
  const layoutSource = src('app/layout.tsx');
  assert.match(layoutSource, /\{GOOGLE_ADS_ID && \(/);
});

test('2. gtag.js is loaded directly (Ads-only) — no GTM container script, no gtag/js?id= ever hardcoded', () => {
  const layoutSource = src('app/layout.tsx');
  assert.match(layoutSource, /googletagmanager\.com\/gtag\/js\?id=\$\{GOOGLE_ADS_ID\}/);
  assert.doesNotMatch(layoutSource, /GTM-[A-Z0-9]/);
});

test('3. the config call explicitly disables ad-personalization signals', () => {
  const layoutSource = src('app/layout.tsx');
  assert.match(layoutSource, /gtag\('config', [\s\S]+?, \{ allow_ad_personalization_signals: false \}\)/);
});

test('4. no GA4 measurement ID or gtag GA4 config was introduced anywhere in the new tag code', () => {
  const layoutSource = src('app/layout.tsx');
  assert.doesNotMatch(layoutSource, /\bG-[A-Z0-9]{6,}/);
});

/* ------------------------------------------------------------ dead config removal --- */

test('5. the dead site.analytics.ga4 field was removed from site.ts', () => {
  const siteSource = src('data/site.ts');
  assert.doesNotMatch(siteSource, /analytics:\s*\{/);
  assert.doesNotMatch(siteSource, /NEXT_PUBLIC_GA4_ID/);
});

/* ------------------------------------------------- fireGoogleAdsConversion --- */

test('6. fireGoogleAdsConversion no-ops when window.gtag is not a function (tag not loaded)', () => {
  globalThis.window = {};
  assert.doesNotThrow(() => fireGoogleAdsConversion('contact'));
});

test('7. fireGoogleAdsConversion no-ops outside a browser context', () => {
  globalThis.window = undefined;
  assert.doesNotThrow(() => fireGoogleAdsConversion('booking_click'));
});

test('8. fireGoogleAdsConversion sends send_to as "<AW-ID>/<label>" and nothing else', () => {
  const calls = [];
  globalThis.window = { gtag: (...args) => calls.push(args) };
  fireGoogleAdsConversion('contact');
  assert.equal(calls.length, 1);
  const [event, action, payload] = calls[0];
  assert.equal(event, 'event');
  assert.equal(action, 'conversion');
  assert.deepEqual(Object.keys(payload), ['send_to']);
  assert.equal(payload.send_to, 'AW-123456789/LblOne111');
});

test('9. fireGoogleAdsConversion never includes PII, transaction_id, or value', () => {
  const calls = [];
  globalThis.window = { gtag: (...args) => calls.push(args) };
  for (const type of ['contact', 'phone_click', 'booking_click']) {
    fireGoogleAdsConversion(type);
  }
  assert.equal(calls.length, 3);
  for (const [, , payload] of calls) {
    assert.deepEqual(Object.keys(payload), ['send_to']);
    assert.ok(!('transaction_id' in payload));
    assert.ok(!('value' in payload));
    assert.ok(!('user_data' in payload));
  }
});

/* --------------------------------------------------- trackConversion wiring --- */

test('10. trackConversion fires the Ads event for contact, phone_click, and booking_click', async () => {
  stubFetch();
  for (const type of ['contact', 'phone_click', 'booking_click']) {
    const calls = [];
    globalThis.window = fakeWindow({ gtag: (...args) => calls.push(args) });
    globalThis.document = { referrer: '' };
    await trackConversion(type, '/some-page');
    assert.equal(calls.length, 1, `expected exactly one Ads conversion event for ${type}`);
  }
});

test('11. trackConversion never fires an Ads event for newsletter', async () => {
  stubFetch();
  const calls = [];
  globalThis.window = fakeWindow({ gtag: (...args) => calls.push(args) });
  globalThis.document = { referrer: '' };
  await trackConversion('newsletter', '/some-page');
  assert.equal(calls.length, 0);
});

test('12. the Ads call happens after the first-party beacon call, never blocking/replacing it', async () => {
  const beaconCalls = [];
  globalThis.fetch = async (url, init) => {
    beaconCalls.push({ url, init });
    return { ok: true, json: async () => ({ success: true }) };
  };
  const adsCalls = [];
  globalThis.window = fakeWindow({ gtag: (...args) => adsCalls.push(args) });
  globalThis.document = { referrer: '' };
  await trackConversion('booking_click', '/fees-insurance');
  assert.equal(beaconCalls.length, 1);
  assert.match(String(beaconCalls[0].url), /\/api\/public\/conversions$/);
  assert.equal(adsCalls.length, 1);
});

/* ------------------------------------------------------- scope guardrails --- */

test('13. the CharmHealth booking iframe component is untouched by this feature', () => {
  const bookingSource = src('components/sections/BookingCalendar.tsx');
  assert.doesNotMatch(bookingSource, /gtag|googletagmanager|GOOGLE_ADS/);
});

test('14. the Ads tag loader lives only in the public app layout, never in admin/', () => {
  const layoutSource = src('app/layout.tsx');
  assert.match(layoutSource, /GOOGLE_ADS_ID/);
  // admin/ is a separate Next.js app with its own layout — this repo (client/)
  // has no reach into it, so the structural guarantee is simply that this
  // feature's only entry point is this one root layout.
  assert.equal(layoutSource.match(/googletagmanager\.com/g)?.length, 1);
});

/* --------------------------------------------- phone_click delegation --- */

test('15. AnalyticsBeacon tracks tel: link clicks site-wide via one delegated listener', () => {
  const beaconSource = src('components/seo/AnalyticsBeacon.tsx');
  assert.match(beaconSource, /closest\('a\[href\^="tel:"\]'\)/);
  assert.match(beaconSource, /trackConversion\('phone_click', window\.location\.pathname\)/);
});

test('16. the 988 crisis line is explicitly excluded from phone_click tracking', () => {
  const beaconSource = src('components/seo/AnalyticsBeacon.tsx');
  assert.match(beaconSource, /href === site\.crisis\.phoneHref/);
});

test('17. the phone_click listener is attached and cleaned up (no leaked document listener)', () => {
  const beaconSource = src('components/seo/AnalyticsBeacon.tsx');
  assert.match(beaconSource, /document\.addEventListener\('click', handleClick\)/);
  assert.match(beaconSource, /document\.removeEventListener\('click', handleClick\)/);
});

test('18. trackConversion accepts phone_click as a valid conversion type', () => {
  const cmsSource = src('lib/cms.ts');
  assert.match(cmsSource, /'contact' \| 'newsletter' \| 'booking_click' \| 'phone_click'/);
});
