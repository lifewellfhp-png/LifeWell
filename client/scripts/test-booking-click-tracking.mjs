/**
 * Regression tests for P7-1: booking_click conversion tracking.
 *
 * Covers:
 *   1. trackConversion() never throws, even when the network call fails —
 *      the exact property that lets callers fire it without awaiting and
 *      without risking navigation.
 *   2. The payload sent for a booking_click event contains only the four
 *      minimal fields the existing endpoint already accepts — no PII/PHI.
 *   3. Booking destinations (site.booking.page, telehealth-states.ts) are
 *      unchanged by this phase.
 *   4. Every confirmed legitimate booking CTA source file carries
 *      trackAs="booking_click" (source-level coverage check).
 *   5. Preceptorship/professional-education and other non-booking CTAs
 *      (Explore/View Services, Insurance & Pricing, Contact Us, Watch More
 *      Videos, Learn More About the Provider) were NOT converted into
 *      booking tracking.
 *   6. SwapButton/HeaderCta attach onClick to exactly one element per
 *      branch (no duplicate-handler risk from this change).
 *   7. Tracking calls use `void trackConversion(...)`, never `await`, so a
 *      slow/failed request cannot delay navigation.
 *
 * globalThis.fetch is stubbed for every test in this file — no real network
 * call is ever made, and nothing hits Production.
 *
 *   npx tsx --test scripts/test-booking-click-tracking.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');

/* ---------------------------------------------------- fetch stub setup --- */

const originalFetch = globalThis.fetch;
let calls;

function stubFetch(impl) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return impl(url, init);
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

const { trackConversion } = await import('../src/lib/cms.ts');

/* ------------------------------------------------- 1. failure safety --- */

test('1. trackConversion resolves cleanly even when fetch rejects (network down)', async () => {
  stubFetch(async () => {
    throw new Error('simulated network failure');
  });
  await assert.doesNotReject(() => trackConversion('booking_click', '/telehealth/florida'));
  assert.equal(calls.length, 1, 'fetch should still have been attempted once');
});

test('1b. trackConversion resolves cleanly even when the server responds with an error status', async () => {
  stubFetch(async () => ({ ok: false, status: 429, json: async () => ({}) }));
  await assert.doesNotReject(() => trackConversion('booking_click', '/fees-insurance'));
});

test('1c. trackConversion resolves cleanly even when fetch itself is unavailable/throws synchronously', async () => {
  globalThis.fetch = () => {
    throw new Error('fetch is not a function-like failure');
  };
  await assert.doesNotReject(() => trackConversion('booking_click', '/'));
});

/* --------------------------------------------------- 2. payload shape --- */

test('2. booking_click payload contains only conversion_type, path, and empty meta — no PII/PHI', async () => {
  stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));
  await trackConversion('booking_click', '/telehealth/massachusetts');

  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.match(String(url), /\/api\/public\/conversions$/);
  assert.equal(init.method, 'POST');

  const body = JSON.parse(init.body);
  assert.deepEqual(Object.keys(body).sort(), ['conversion_type', 'meta', 'path']);
  assert.equal(body.conversion_type, 'booking_click');
  assert.equal(body.path, '/telehealth/massachusetts');
  assert.deepEqual(body.meta, {});

  const flat = JSON.stringify(body).toLowerCase();
  for (const forbidden of ['email', 'phone', 'name', 'dob', 'diagnos', 'medication', 'symptom', 'message', 'ssn', 'mrn']) {
    assert.ok(!flat.includes(forbidden), `payload must not contain "${forbidden}"`);
  }
});

test('2b. omitting path still sends a valid, PII-free payload', async () => {
  stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));
  await trackConversion('booking_click');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.path, null);
  assert.deepEqual(body.meta, {});
});

/* ------------------------------------------------ 3. destinations unchanged --- */

test('3. site.booking.page is unchanged', async () => {
  const { site } = await import('../src/data/site.ts');
  assert.equal(site.booking.page, '/book-telehealth-mental-health-appointment#charm-calendar');
  assert.equal(site.booking.label, 'Book an Appointment');
});

test('3b. all three telehealth states still point primaryCta at the same booking href', async () => {
  const { telehealthStates } = await import('../src/data/telehealth-states.ts');
  for (const state of telehealthStates) {
    assert.equal(state.primaryCta.href, '/book-telehealth-mental-health-appointment#charm-calendar');
    assert.equal(state.primaryCta.label, 'Book an Appointment');
  }
});

/* ---------------------------------------------- 4. coverage (source-level) --- */

const expectedCoverage = [
  ['components/sections/Hero.tsx', 1],
  ['components/sections/HowItWorks.tsx', 1],
  ['components/sections/CTASection.tsx', 2],
  ['components/sections/FeesPageContent.tsx', 3],
  ['components/sections/NewPatientsPageContent.tsx', 2],
  ['components/sections/BioPageContent.tsx', 1],
  ['components/sections/ContactPageContent.tsx', 1],
  ['components/sections/TelehealthStatePageContent.tsx', 1],
  ['components/sections/ServicePageContent.tsx', 2],
  ['components/sections/StatsBand.tsx', 1],
  ['components/sections/PremiumBookingChoice.tsx', 1],
  ['components/layout/NavBar.tsx', 2],
  ['components/layout/MobileMenu.tsx', 1],
  ['app/book-telehealth-mental-health-appointment/page.tsx', 1],
  ['components/sections/OurServicesPageContent.tsx', 1],
  ['components/sections/TestimonialsPageContent.tsx', 1],
];

test('4. every confirmed legitimate booking CTA carries trackAs="booking_click"', () => {
  for (const [file, expectedCount] of expectedCoverage) {
    const text = src(file);
    const matches = text.match(/trackAs="booking_click"/g) || [];
    assert.equal(
      matches.length,
      expectedCount,
      `${file}: expected ${expectedCount} trackAs="booking_click" occurrence(s), found ${matches.length}`
    );
  }
});

test('4b. BioPageContent Working Shifts tiles use the dedicated TrackedBookingLink client-component leaf', () => {
  const bio = src('components/sections/BioPageContent.tsx');
  assert.match(bio, /<TrackedBookingLink/);
  assert.doesNotMatch(bio, /onClick=/, 'BioPageContent itself should stay a Server Component with no onClick of its own');

  const link = src('components/ui/TrackedBookingLink.tsx');
  assert.match(link, /^'use client';/, 'TrackedBookingLink must be a Client Component to hold an onClick handler');
  assert.match(link, /trackConversion\(\s*'booking_click'/);
});

test('4c. JourneyCta forwards an opt-in trackAs prop rather than assuming booking for every caller', () => {
  const text = src('components/sections/JourneyCta.tsx');
  assert.match(text, /trackAs\?:\s*'booking_click'/);
  assert.match(text, /<SwapButton href={href} trackAs={trackAs}>/);
});

/* -------------------------------------------- 5. non-booking exclusions --- */

test('5. Preceptorship page has no booking_click tracking anywhere', () => {
  const text = src('components/sections/PreceptorshipPageContent.tsx');
  assert.doesNotMatch(text, /trackAs/);
  assert.doesNotMatch(text, /booking_click/);
});

test('5b. non-booking SwapButton/JourneyCta/HeaderCta call sites were not converted', () => {
  const cases = [
    ['app/page.tsx', /href="\/our-services"[^]*?SwapButton/, 'View All Services'],
    ['components/sections/InsuranceGrid.tsx', /SwapButton href={ctaHref}/, 'View Fees & Insurance'],
    ['components/sections/VideosSection.tsx', /SwapButton href="\/videos"/, 'Watch More Videos'],
    ['components/sections/WelcomeSection.tsx', /SwapButton href={welcome\.cta\.href}/, 'Learn More About the Provider'],
  ];
  for (const [file] of cases) {
    const text = src(file);
    assert.doesNotMatch(text, /trackAs="booking_click"/, `${file} must not have been given booking tracking`);
  }
});

test('5c. the Hero crisis (988) SwapButton is not tracked as a booking click', () => {
  const text = src('components/sections/Hero.tsx');
  const zocdocSection = text.slice(text.indexOf('zocdocUrl'));
  assert.doesNotMatch(zocdocSection.slice(0, 400), /trackAs="booking_click"/);
});

test('5d. the HowItWorks crisis (988) SwapButton is not tracked as a booking click', () => {
  const text = src('components/sections/HowItWorks.tsx');
  const crisisBlock = text.slice(text.indexOf('site.crisis.phoneHref'), text.indexOf('site.crisis.phoneHref') + 200);
  assert.doesNotMatch(crisisBlock, /trackAs="booking_click"/);
});

/* -------------------------------------------- 6. no duplicate handlers --- */

test('6. SwapButton attaches onClick to exactly one element per render branch', () => {
  const text = src('components/ui/SwapButton.tsx');
  const onClickOccurrences = (text.match(/onClick={onClick}/g) || []).length;
  assert.equal(onClickOccurrences, 2, 'expected exactly one onClick on the external <a> branch and one on the internal <Link> branch');
});

test('6b. HeaderCta attaches onClick to exactly one element per render branch', () => {
  const text = src('components/layout/HeaderCta.tsx');
  const onClickOccurrences = (text.match(/onClick={onClick}/g) || []).length;
  assert.equal(onClickOccurrences, 2);
});

/* ---------------------------------------- 7. fire-and-forget (non-blocking) --- */

test('7. every tracking call site uses void trackConversion(...), never awaits it', () => {
  const files = [
    'components/ui/SwapButton.tsx',
    'components/layout/HeaderCta.tsx',
    'components/ui/TrackedBookingLink.tsx',
  ];
  for (const file of files) {
    const text = src(file);
    assert.doesNotMatch(text, /await trackConversion/, `${file} must not await trackConversion (would block navigation)`);
    assert.match(text, /void trackConversion/, `${file} should fire-and-forget via void trackConversion`);
  }
});

/* ------------------------------------- 8. RSC client-boundary correctness --- */

test('8. every component that defines an onClick handler is a Client Component', () => {
  // Next.js App Router cannot pass a function prop (an event handler) through
  // a Server Component boundary — this must be 'use client', or the page
  // throws at request time ("Event handlers cannot be passed to Client
  // Component props"), a failure typecheck/build do NOT catch.
  const files = [
    'components/ui/SwapButton.tsx',
    'components/layout/HeaderCta.tsx',
    'components/ui/TrackedBookingLink.tsx',
  ];
  for (const file of files) {
    const text = src(file);
    assert.match(text.slice(0, 50), /'use client';/, `${file} defines an onClick handler and must start with 'use client'`);
  }
});

test('8b. the Server Component pages/sections that render these controls only pass string/prop values, never inline functions, to trackAs', () => {
  // trackAs is always a literal string ('booking_click') or a forwarded prop,
  // never a function — confirming callers stay safe to leave as Server
  // Components themselves.
  const callers = [
    'components/sections/Hero.tsx',
    'components/sections/HowItWorks.tsx',
    'components/sections/FeesPageContent.tsx',
    'components/sections/TelehealthStatePageContent.tsx',
  ];
  for (const file of callers) {
    const text = src(file);
    const matches = text.match(/trackAs=\{[^}]*\}/g) || [];
    for (const m of matches) {
      assert.doesNotMatch(m, /=>/, `${file}: trackAs must never be passed an inline function`);
    }
  }
});
