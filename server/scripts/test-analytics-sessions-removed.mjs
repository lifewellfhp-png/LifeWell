/**
 * Regression tests for Phase 8 P1-2: remove the permanently-zero "Sessions"
 * KPI from Admin Analytics.
 *
 * Context: no client code path has ever emitted a `session_start` event
 * (confirmed by the Phase 8 audit and unchanged since), so `totals.sessions`
 * and `deltas.sessions` in getAnalyticsSummary's response always rendered
 * "0" next to real numbers, misleading a nontechnical owner. Per the
 * explicit decision this task implements, session tracking is NOT being
 * added now — it is deferred until a defined analytical purpose and privacy
 * model exist. This task only removes the misleading display and its
 * now-dead server computation. The `session_start` event type itself
 * remains defined in the ingest schema/DB check constraint, untouched —
 * that plumbing may be used for a real future feature and is out of scope.
 *
 * Following this codebase's established convention (see
 * test-admin-no-store-cache.mjs, test-dashboard-booking-kpi.mjs,
 * test-analytics-booking-pages.mjs) of testing real production code without
 * a live Supabase connection.
 *
 * No live Supabase connection, no Production credentials, no Production
 * mutation, no ingest schema change.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-analytics-sessions-removed.mjs
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
const controllerSource = controllerSourceRaw.replace(/\r\n/g, '\n');

const summaryStart = controllerSource.indexOf('export async function getAnalyticsSummary');
const summaryEnd = controllerSource.indexOf('\n}', controllerSource.lastIndexOf('res.json({'));
const summarySource = controllerSource.slice(summaryStart, summaryEnd);

test('1. getAnalyticsSummary no longer computes or returns totals.sessions / deltas.sessions', () => {
  assert.ok(summaryStart > -1, 'expected to find getAnalyticsSummary');
  assert.doesNotMatch(summarySource, /sessions:/);
  assert.doesNotMatch(summarySource, /priorSessions/);
});

test("2. session_start is no longer read anywhere inside getAnalyticsSummary", () => {
  assert.doesNotMatch(summarySource, /session_start/);
});

test('3. totals/deltas retain pageViews and conversions, unaffected by the removal', () => {
  const responseBlock = summarySource.slice(summarySource.indexOf('res.json({'));
  assert.match(responseBlock, /totals:\s*\{\s*pageViews:\s*pageViews\.length,\s*conversions:\s*conversions\.length,?\s*\}/);
  assert.match(responseBlock, /deltas:\s*\{\s*pageViews:\s*pct\(pageViews\.length,\s*priorViews\),\s*conversions:\s*pct\(conversions\.length,\s*priorConv\),?\s*\}/);
});

test('4. topBookingPages (P1-1) and all other existing response fields are unaffected', () => {
  const responseBlock = summarySource.slice(summarySource.indexOf('res.json({'));
  for (const field of ['popularPages,', 'devices: byDevice,', 'trafficSources,', 'trends,', 'conversionCounts,', 'topBookingPages,']) {
    assert.ok(responseBlock.includes(field), `expected response to still include: ${field}`);
  }
});

test('5. the session_start event type is NOT removed from the ingest schema/DB (plumbing left in place for a future, separately-designed feature)', () => {
  const schemaSource = readFileSync(join(root, 'src/validation/adminSchemas.ts'), 'utf8');
  assert.match(schemaSource, /event_type: z\.enum\(\['page_view', 'session_start', 'outbound_click'\]\)/);
  const schemaSqlSource = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');
  assert.match(schemaSqlSource, /event_type in \('page_view', 'session_start', 'outbound_click'\)/);
});

test('6. no analytics/conversion ingest handler was touched', () => {
  assert.match(controllerSource, /export async function handleAnalyticsIngest/);
  assert.match(controllerSource, /export async function handleConversionIngest/);
});

test('7. no Production-mutating call (insert/update/delete/upsert) was introduced', () => {
  assert.doesNotMatch(summarySource, /\.insert\(/);
  assert.doesNotMatch(summarySource, /\.update\(/);
  assert.doesNotMatch(summarySource, /\.delete\(/);
  assert.doesNotMatch(summarySource, /\.upsert\(/);
});

test('8. the Admin Analytics page no longer types, reads, or renders a Sessions KPI', () => {
  const pageSourceRaw = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
  assert.doesNotMatch(pageSourceRaw, /sessions/i);
  assert.doesNotMatch(pageSourceRaw, /Globe/);
  assert.doesNotMatch(pageSourceRaw, />Sessions</);
});

test('9. the Page views and Conversions KPI cards remain present and unchanged, now in a 2-column KPI row', () => {
  const pageSourceRaw = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
  assert.match(pageSourceRaw, />Page views</);
  assert.match(pageSourceRaw, />Conversions</);
  assert.match(pageSourceRaw, /className="kpi-grid two"/);
  assert.doesNotMatch(pageSourceRaw, /kpi-grid three/);
});

test('10. the Dashboard home page (separate 6-KPI grid) is untouched by this change', () => {
  const dashPageSource = readFileSync(join(root, '../admin/src/app/(app)/page.tsx'), 'utf8');
  assert.match(dashPageSource, /className="kpi-grid"/);
  assert.doesNotMatch(dashPageSource, /session/i);
});

test('11. the shared globals.css .kpi-grid.two rule is additive — the 6-column desktop layout for ungrouped kpi-grids (Dashboard home) is preserved', () => {
  const cssSource = readFileSync(join(root, '../admin/src/app/globals.css'), 'utf8');
  assert.match(cssSource, /\.kpi-grid\.two\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);\s*\}/);
  assert.match(cssSource, /\.kpi-grid:not\(\.two\)\s*\{\s*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\);\s*\}/);
});

// --- Behavioral: the summary route still requires admin auth + permission, unaffected ---

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

test('12. /api/admin/analytics/summary still requires authentication (unaffected by this change)', async () => {
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
