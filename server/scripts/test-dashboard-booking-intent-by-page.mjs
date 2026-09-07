/**
 * Regression tests for Phase 8 P1-1: "Booking Intent by Page" on the Admin
 * Dashboard home page (admin/src/app/(app)/page.tsx), backed by a new
 * bookingIntentByPage field on the existing GET /api/admin/dashboard
 * response (server/src/routes/admin.routes.ts).
 *
 * A conceptually similar breakdown (topBookingPages) already exists on the
 * separate Admin Analytics page — that feature is intentionally untouched
 * by this task (see test-analytics-booking-pages.mjs). This one is new,
 * dashboard-specific, and has stricter guarantees that feature doesn't:
 * it always uses the SAME fixed 7-day since7 window as the "Booking
 * clicks" KPI card next to it (not a selectable/defaulted-to-30-days
 * range), it is never capped (no top-N slice, so the displayed sum can
 * never silently fall short of the true total), and null/blank paths get
 * their own explicit "Unknown / Unattributed" bucket rather than being
 * folded into Homepage.
 *
 * Following this codebase's established convention: aggregateBookingIntentByPage
 * and friendlyBookingPageLabel are pure functions, unit-tested directly
 * with synthetic input (no live Supabase connection needed); the /dashboard
 * route's query construction is verified via source-structure assertions on
 * the REAL router source, the same technique test-dashboard-booking-kpi.mjs
 * already uses for this exact route.
 *
 * No live Supabase connection, no Production credentials, no Production
 * mutation, no new tracking/ingest.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-dashboard-booking-intent-by-page.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  aggregateBookingIntentByPage,
  friendlyBookingPageLabel,
  BOOKING_PATH_LABELS,
  BOOKING_PATH_UNKNOWN_LABEL,
} from '../src/routes/admin.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const routesSourceRaw = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
// Normalized to LF so slicing/regex boundaries are line-ending agnostic
// (this repo is checked out with CRLF on Windows).
const routesSource = routesSourceRaw.replace(/\r\n/g, '\n');

const dashboardStart = routesSource.indexOf("adminRouter.get(\n  '/dashboard',");
const dashboardEnd = routesSource.indexOf('\n);\n', dashboardStart);
const dashboardSource = routesSource.slice(dashboardStart, dashboardEnd);

const adminPageSourceRaw = readFileSync(join(root, '../admin/src/app/(app)/page.tsx'), 'utf8');
const adminPageSource = adminPageSourceRaw.replace(/\r\n/g, '\n');

// --- 1-5. Query scope: booking_click only, same since7 window, no other type ----

test('1. the new conversions query still filters conversion_type = booking_click only', () => {
  assert.match(dashboardSource, /\.from\('conversions'\)[\s\S]{0,120}\.eq\('conversion_type',\s*'booking_click'\)/);
});

test('2. the new conversions query still uses the exact same since7 boundary as conversions7d', () => {
  assert.match(dashboardSource, /\.from\('conversions'\)[\s\S]{0,200}\.gte\('created_at',\s*since7\)/);
  // Only ONE conversions query exists in this route — bookingIntentByPage
  // and conversions7d are necessarily the same window because they come
  // from the exact same query result, not two separate queries.
  const conversionsQueryCount = (dashboardSource.match(/\.from\('conversions'\)/g) || []).length;
  assert.equal(conversionsQueryCount, 1, 'expected exactly one conversions query, shared by conversions7d and bookingIntentByPage');
});

test('3. contact is never used as a filter value on the conversions query', () => {
  assert.doesNotMatch(dashboardSource.slice(dashboardSource.indexOf(".from('conversions')")), /'contact'/);
});

test('4. newsletter is never used as a filter value on the conversions query', () => {
  assert.doesNotMatch(dashboardSource.slice(dashboardSource.indexOf(".from('conversions')")), /'newsletter'/);
});

test('5. bookingIntentByPage is derived from conversions.data — the same already-type-filtered result conversions7d uses, not an unrelated/unfiltered source', () => {
  assert.match(dashboardSource, /aggregateBookingIntentByPage\(conversions\.data \?\? \[\]\)/);
});

// --- 6-8. Unknown/Unattributed handling -----------------------------------------

test('6. a null path is retained, not dropped, and bucketed as Unknown / Unattributed', () => {
  const result = aggregateBookingIntentByPage([{ path: null }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].path, null);
  assert.equal(result[0].label, BOOKING_PATH_UNKNOWN_LABEL);
  assert.equal(result[0].count, 1);
});

test('7. a blank ("" or whitespace-only) path is retained and bucketed the same way as null', () => {
  const result = aggregateBookingIntentByPage([{ path: '' }, { path: '   ' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].path, null);
  assert.equal(result[0].count, 2);
});

test('8. the Unknown/Unattributed label is exactly "Unknown / Unattributed"', () => {
  assert.equal(BOOKING_PATH_UNKNOWN_LABEL, 'Unknown / Unattributed');
});

// --- 9-10. Friendly labels for known routes --------------------------------------

test('9. the homepage path "/" maps to "Homepage"', () => {
  assert.equal(friendlyBookingPageLabel('/'), 'Homepage');
  assert.equal(BOOKING_PATH_LABELS['/'], 'Homepage');
});

test('10. known static routes map to the correct friendly labels, matching client/src/data/navigation.ts wording', () => {
  const expected = {
    '/fees-insurance': 'Fees & Insurance',
    '/our-services': 'Our Services',
    '/bio': 'Provider',
    '/new-patients': 'New Patients',
    '/contact-telehealth-mental-health-provider': 'Contact',
    '/telehealth-mental-health-testimonials': 'Testimonials',
    '/book-telehealth-mental-health-appointment': 'Booking Page',
    '/orlando-psychiatric-care': 'Orlando Office',
    '/faqs': 'FAQs',
    '/blog': 'Blog',
    '/videos': 'Videos',
  };
  for (const [path, label] of Object.entries(expected)) {
    assert.equal(friendlyBookingPageLabel(path), label, `expected ${path} -> ${label}`);
  }
  // These routes are verified to actually exist in client/src/app.
  const clientAppDir = join(root, '../client/src/app');
  for (const routePath of Object.keys(expected)) {
    const segment = routePath.slice(1);
    const pagePath = join(clientAppDir, segment, 'page.tsx');
    assert.ok(existsSyncSafe(pagePath), `expected a real route at client/src/app/${segment}/page.tsx`);
  }
});

test('10b. the three real telehealth state routes map to their state-specific labels', () => {
  assert.equal(friendlyBookingPageLabel('/telehealth/florida'), 'Florida Telehealth');
  assert.equal(friendlyBookingPageLabel('/telehealth/massachusetts'), 'Massachusetts Telehealth');
  assert.equal(friendlyBookingPageLabel('/telehealth/arizona'), 'Arizona Telehealth');
});

// --- 11-12. Unknown/dynamic routes stay visible and distinguishable --------------

test('11. an unrecognized path remains visible with a derived, human-readable label rather than being discarded', () => {
  const result = aggregateBookingIntentByPage([{ path: '/brand-new-landing-page' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].path, '/brand-new-landing-page');
  assert.equal(result[0].label, 'Brand New Landing Page');
});

test('12. distinct service-detail paths are never collapsed into one generic bucket', () => {
  const result = aggregateBookingIntentByPage([
    { path: '/services/medication-management' },
    { path: '/services/medication-management' },
    { path: '/services/psychiatric-evaluation' },
  ]);
  assert.equal(result.length, 2);
  const byPath = Object.fromEntries(result.map((r) => [r.path, r]));
  assert.equal(byPath['/services/medication-management'].count, 2);
  assert.equal(byPath['/services/medication-management'].label, 'Medication Management');
  assert.equal(byPath['/services/psychiatric-evaluation'].count, 1);
  assert.equal(byPath['/services/psychiatric-evaluation'].label, 'Psychiatric Evaluation');
});

// --- 13-14. Sort order -------------------------------------------------------------

test('13. results are sorted by count, descending', () => {
  const result = aggregateBookingIntentByPage([
    { path: '/a' }, { path: '/a' },
    { path: '/b' }, { path: '/b' }, { path: '/b' },
    { path: '/c' },
  ]);
  assert.deepEqual(result.map((r) => r.count), [3, 2, 1]);
  assert.deepEqual(result.map((r) => r.path), ['/b', '/a', '/c']);
});

test('14. ties break deterministically by path (ascending), with Unknown/Unattributed sorting after real paths at the same count', () => {
  const result = aggregateBookingIntentByPage([
    { path: '/zebra' }, { path: '/alpha' }, { path: null },
  ]);
  assert.deepEqual(result.map((r) => r.count), [1, 1, 1]);
  assert.deepEqual(result.map((r) => r.path), ['/alpha', '/zebra', null]);
});

// --- 15. Exact reconciliation ------------------------------------------------------

test('15. the sum of every breakdown count equals the total number of booking_click rows for equivalent fixture data (no cap, nothing dropped)', () => {
  const rows = [
    { path: '/' }, { path: '/' }, { path: '/' },
    { path: '/fees-insurance' },
    { path: '/services/medication-management' },
    { path: null },
    { path: '' },
    { path: '/telehealth/florida' },
  ];
  const result = aggregateBookingIntentByPage(rows);
  const total = result.reduce((sum, r) => sum + r.count, 0);
  assert.equal(total, rows.length);
});

test('15b. this breakdown is never capped/sliced — unlike the separate Analytics topBookingPages (top-15) feature, every distinct path is returned', () => {
  const manyPaths = Array.from({ length: 20 }, (_, i) => ({ path: `/page-${i}` }));
  const result = aggregateBookingIntentByPage(manyPaths);
  assert.equal(result.length, 20);
  assert.doesNotMatch(dashboardSource, /aggregateBookingIntentByPage\([^)]*\)\.slice\(/);
});

// --- 16-17. Admin UI wiring ---------------------------------------------------------

test('16. the Admin Dashboard page reads data.bookingIntentByPage from the dashboard API response', () => {
  assert.match(adminPageSource, /bookingIntentByPage/);
  assert.match(adminPageSource, /data\??\.bookingIntentByPage/);
});

test('17. the Admin Dashboard renders a professional empty state when there are zero booking clicks in the window', () => {
  assert.match(adminPageSource, /No booking clicks recorded in the last 7 days\./);
});

// --- 18-19. P0-1 protection ---------------------------------------------------------

test('18. the existing conversions7d field/binding is unchanged', () => {
  assert.match(dashboardSource, /conversions7d:\s*conversions\.count\s*\?\?\s*0/);
});

test('19. the existing "Booking clicks" KPI label is unchanged and still reads conversions7d', () => {
  assert.match(
    adminPageSource,
    /\{\s*label:\s*'Booking clicks',\s*key:\s*'conversions7d'/,
    'expected the existing "Booking clicks" KPI tile to still read conversions7d, unmodified'
  );
});

// --- 20. Sessions KPI untouched ------------------------------------------------------

test('20. this change does not introduce, restore, or reference a Sessions KPI anywhere in the dashboard route or Admin Dashboard page', () => {
  assert.doesNotMatch(dashboardSource, /[Ss]essions?/);
  const bookingSectionStart = adminPageSource.indexOf('bookingIntentByPage');
  assert.ok(bookingSectionStart > -1);
});

// --- 21-22. No new tracking/ingest, no new write path --------------------------------

test('21. no analytics/conversion ingest schema was touched by this change', () => {
  const schemaSource = readFileSync(join(root, 'src/validation/adminSchemas.ts'), 'utf8');
  assert.match(schemaSource, /export const analyticsIngestSchema = z\.object\(\{/);
  assert.match(schemaSource, /export const conversionIngestSchema = z\.object\(\{/);
  assert.match(schemaSource, /conversion_type: z\.enum\(\['contact', 'newsletter', 'booking_click'\]\)/);
});

test('22. no Production-mutating call (insert/update/delete/upsert) exists in the dashboard route', () => {
  assert.doesNotMatch(dashboardSource, /\.insert\(/);
  assert.doesNotMatch(dashboardSource, /\.update\(/);
  assert.doesNotMatch(dashboardSource, /\.delete\(/);
  assert.doesNotMatch(dashboardSource, /\.upsert\(/);
});

// --- 23. Auth remains required -------------------------------------------------------

test('23. the /dashboard route registration still requires admin auth (unchanged)', () => {
  assert.match(dashboardSource, /adminRouter\.get\(\s*\n\s*'\/dashboard',\s*\n\s*requireAdmin,/);
});

// --- 24. No PII/PHI in the breakdown response -----------------------------------------

test('24. the breakdown response shape never includes PII/PHI fields — only path, label, count', () => {
  const result = aggregateBookingIntentByPage([{ path: '/fees-insurance', email: 'someone@example.com', name: 'Someone', id: 'abc-123' }]);
  const keys = Object.keys(result[0]).sort();
  assert.deepEqual(keys, ['count', 'label', 'path']);
});

test('24b. the dashboard route selects only `path` from conversions — no id/meta/email/device/referrer fetched for this feature', () => {
  const selectMatch = dashboardSource.match(/\.from\('conversions'\)\s*\n?\s*\.select\('([^']+)'/);
  assert.ok(selectMatch, 'expected a .select() on the conversions query');
  assert.equal(selectMatch[1], 'path');
});

function existsSyncSafe(p) {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}
