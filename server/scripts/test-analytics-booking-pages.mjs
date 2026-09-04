/**
 * Regression tests for Phase 8 P1-1: surface booking_click counts by page
 * ("Top booking-intent pages") in Admin Analytics, using conversions.path —
 * already stored on every booking_click event, no new tracking or schema
 * change required.
 *
 * Following this codebase's established convention (see
 * test-admin-no-store-cache.mjs, test-dashboard-booking-kpi.mjs) of testing
 * real production code without a live Supabase connection: no
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is set in this environment, so
 * getAnalyticsSummary cannot be exercised end-to-end here. These tests
 * assert against the REAL controller/route source (imported directly, not a
 * copy) that the aggregation is scoped to conversion_type = 'booking_click'
 * only, sorted/limited the same way as the existing popularPages
 * aggregation, and returned under a new, additive field — plus a behavioral
 * test proving the summary route still requires admin auth + the
 * 'analytics' permission, unaffected by this change.
 *
 * No live Supabase connection, no Production credentials, no Production
 * mutation, no analytics/conversion ingest schema change.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-analytics-booking-pages.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adminRouter } from '../src/routes/admin.routes.js';
import { errorHandler, notFoundHandler } from '../src/middleware/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const controllerSourceRaw = readFileSync(join(root, 'src/controllers/analytics.controller.ts'), 'utf8');
// Normalized to LF so slicing/regex boundaries are line-ending agnostic
// (this repo is checked out with CRLF on Windows).
const controllerSource = controllerSourceRaw.replace(/\r\n/g, '\n');

const summaryStart = controllerSource.indexOf('export async function getAnalyticsSummary');
const summaryEnd = controllerSource.indexOf('\n}', controllerSource.lastIndexOf('res.json({'));
const summarySource = controllerSource.slice(summaryStart, summaryEnd);

test('1. getAnalyticsSummary aggregates booking_click conversions by path into a new topBookingPages field', () => {
  assert.ok(summaryStart > -1, 'expected to find getAnalyticsSummary');
  assert.match(summarySource, /byBookingClickPath\[path\] = \(byBookingClickPath\[path\] \?\? 0\) \+ 1/);
  assert.match(summarySource, /topBookingPages/);
});

test("2. the aggregation is scoped to conversion_type === 'booking_click' only (excludes contact/newsletter)", () => {
  const aggStart = summarySource.indexOf('byBookingClickPath');
  const aggBlock = summarySource.slice(aggStart, aggStart + 400);
  assert.match(aggBlock, /c\.conversion_type !== 'booking_click'/);
  assert.doesNotMatch(aggBlock, /'contact'/);
  assert.doesNotMatch(aggBlock, /'newsletter'/);
});

test('3. topBookingPages is sorted descending and capped at 15, matching the existing popularPages pattern', () => {
  const popularBlock = summarySource.slice(
    summarySource.indexOf('const popularPages'),
    summarySource.indexOf('const popularPages') + 200
  );
  const bookingBlock = summarySource.slice(
    summarySource.indexOf('const topBookingPages'),
    summarySource.indexOf('const topBookingPages') + 200
  );
  for (const block of [popularBlock, bookingBlock]) {
    assert.match(block, /\.sort\(\(a, b\) => b\.\w+ - a\.\w+\)/);
    assert.match(block, /\.slice\(0, 15\)/);
  }
});

test('4. topBookingPages is included in the response payload alongside the existing fields, none removed', () => {
  const responseStart = summarySource.indexOf('res.json({');
  const responseBlock = summarySource.slice(responseStart);
  for (const field of ['popularPages,', 'devices: byDevice,', 'trafficSources,', 'trends,', 'conversionCounts,', 'topBookingPages,']) {
    assert.ok(responseBlock.includes(field), `expected response to still include: ${field}`);
  }
});

test('5. existing popularPages (page-view) and conversionCounts (type totals) aggregation logic is untouched', () => {
  assert.match(summarySource, /const popularPages = Object\.entries\(byPath\)/);
  assert.match(summarySource, /const conversionCounts = conversions\.reduce<Record<string, number>>/);
});

test('6. no analytics/conversion ingest schema or ingest handlers were touched by this change', () => {
  assert.match(controllerSource, /export async function handleAnalyticsIngest/);
  assert.match(controllerSource, /export async function handleConversionIngest/);
  const schemaSource = readFileSync(join(root, 'src/validation/adminSchemas.ts'), 'utf8');
  assert.match(schemaSource, /conversion_type: z\.enum\(\['contact', 'newsletter', 'booking_click'\]\)/);
});

test('7. no Production-mutating call (insert/update/delete/upsert) was introduced into getAnalyticsSummary', () => {
  assert.doesNotMatch(summarySource, /\.insert\(/);
  assert.doesNotMatch(summarySource, /\.update\(/);
  assert.doesNotMatch(summarySource, /\.delete\(/);
  assert.doesNotMatch(summarySource, /\.upsert\(/);
});

test('8. the Admin Analytics page reads topBookingPages and renders it via the existing BarList component (no new chart library)', () => {
  const pageSourceRaw = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
  const pageSource = pageSourceRaw.replace(/\r\n/g, '\n');
  assert.match(pageSource, /topBookingPages:\s*\{\s*path:\s*string;\s*clicks:\s*number\s*\}\[\]/);
  assert.match(pageSource, /data\?\.topBookingPages/);
  assert.match(pageSource, /<BarList points=\{bookingPages\}/);
});

test('9. the new Admin section does not claim a confirmed appointment/booking was made — only booking intent', () => {
  const pageSourceRaw = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
  assert.match(pageSourceRaw, /booking intent, not a confirmed appointment/);
  assert.doesNotMatch(pageSourceRaw, /booked appointment/i);
  assert.doesNotMatch(pageSourceRaw, /new patient/i);
});

test('10. this change does not implement P1-2 (Sessions) or any other Phase 8 recommendation', () => {
  assert.doesNotMatch(summarySource, /session_start.*fix|fixed.*session/i);
  // Sessions totals logic must be present and untouched, not removed or altered.
  assert.match(controllerSource, /sessions: events\.filter\(\(e\) => e\.event_type === 'session_start'\)\.length/);
});

// --- Behavioral: the summary route still requires admin auth + permission ---

function startRealAdminApp() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
    const server = app.listen(0, () => resolve(server));
  });
}

test('11. /api/admin/analytics/summary still requires authentication (unaffected by this change)', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/analytics/summary`);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  } finally {
    server.close();
  }
});

test("12. the /analytics/summary route registration still requires the 'analytics' permission (unchanged)", () => {
  const routesSourceRaw = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
  const routesSource = routesSourceRaw.replace(/\r\n/g, '\n');
  assert.match(
    routesSource,
    /'\/analytics\/summary',\n\s*requireAdmin,\n\s*requirePermission\('analytics'\),\n\s*asyncHandler\(getAnalyticsSummary\)/
  );
});
