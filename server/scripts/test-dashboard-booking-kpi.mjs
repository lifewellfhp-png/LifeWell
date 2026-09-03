/**
 * Regression tests for Phase 8 P0-1: the Admin Dashboard home "Booking
 * clicks" KPI must count only conversion_type = 'booking_click', not every
 * row in the conversions table (contact + newsletter + booking_click
 * combined, as the Phase 8 audit found).
 *
 * Following this codebase's established convention (see
 * test-admin-no-store-cache.mjs) of testing real production code without a
 * live Supabase connection: no SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is set
 * in this environment, so the actual query cannot be executed end-to-end
 * here. These tests instead assert against the REAL router source (imported
 * directly, not a copy) that the exact filter chain is present, that no
 * other conversion type is ever filtered for this field, that the existing
 * 7-day window is preserved, and that the Admin-side label/response field
 * this depends on is unchanged. A companion behavioral test proves the
 * route is unreachable without valid auth, same as every other admin route.
 *
 * No live Supabase connection, no Production credentials, no Production
 * mutation.
 *
 *   npx tsx --test scripts/test-dashboard-booking-kpi.mjs
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
const adminRoutesSourceRaw = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
// Normalized to LF so source-slicing/regex boundaries are line-ending
// agnostic (this repo's files are checked out with CRLF on Windows).
const adminRoutesSource = adminRoutesSourceRaw.replace(/\r\n/g, '\n');

// Isolate the /dashboard route handler's source so assertions can't
// accidentally match an unrelated part of the file.
const dashboardStart = adminRoutesSource.indexOf("adminRouter.get(\n  '/dashboard',");
const dashboardEnd = adminRoutesSource.indexOf('\n);\n', dashboardStart);
const dashboardSource = adminRoutesSource.slice(dashboardStart, dashboardEnd);

test('1. the dashboard conversions query filters conversion_type = booking_click', () => {
  assert.ok(dashboardStart > -1, 'expected to find the /dashboard route handler');
  assert.match(dashboardSource, /\.from\('conversions'\)[\s\S]{0,120}\.eq\('conversion_type',\s*'booking_click'\)/);
});

test("2. contact is never used as the conversions7d filter value", () => {
  const conversionsBlockStart = dashboardSource.indexOf(".from('conversions')");
  const conversionsBlockEnd = dashboardSource.indexOf(',', dashboardSource.indexOf('.gte(', conversionsBlockStart));
  const conversionsBlock = dashboardSource.slice(conversionsBlockStart, conversionsBlockEnd + 1);
  assert.doesNotMatch(conversionsBlock, /'contact'/);
});

test("3. newsletter is never used as the conversions7d filter value", () => {
  const conversionsBlockStart = dashboardSource.indexOf(".from('conversions')");
  const conversionsBlockEnd = dashboardSource.indexOf(',', dashboardSource.indexOf('.gte(', conversionsBlockStart));
  const conversionsBlock = dashboardSource.slice(conversionsBlockStart, conversionsBlockEnd + 1);
  assert.doesNotMatch(conversionsBlock, /'newsletter'/);
});

test('4. the existing 7-day time filter (since7) is preserved on the conversions query', () => {
  assert.match(dashboardSource, /\.from\('conversions'\)[\s\S]{0,160}\.gte\('created_at',\s*since7\)/);
});

test('5. the response field name conversions7d is unchanged (no unrelated rename)', () => {
  assert.match(dashboardSource, /conversions7d:\s*conversions\.count\s*\?\?\s*0/);
});

test('6. the Admin Dashboard KPI label "Booking clicks" is unchanged and still reads the conversions7d field', () => {
  const adminPageSource = readFileSync(join(root, '../admin/src/app/(app)/page.tsx'), 'utf8');
  assert.match(
    adminPageSource,
    /\{\s*label:\s*'Booking clicks',\s*key:\s*'conversions7d'/,
    'expected the existing "Booking clicks" KPI tile to still read conversions7d, unmodified'
  );
});

test('7. views7d (page views) filtering is untouched by this change', () => {
  assert.match(dashboardSource, /\.from\('analytics_events'\)\.select\('id, created_at'\)\.eq\('event_type', 'page_view'\)\.gte\('created_at', since7\)/);
});

test('8. no other field in the dashboard response was altered (leads/services/testimonials/faqs/insurance/trend/recentLeads/recentLogs all present, unchanged shape)', () => {
  for (const field of [
    'newLeads: leads.count ?? 0',
    'services: services.count ?? 0',
    'testimonials: testimonials.count ?? 0',
    'faqs: faqs.count ?? 0',
    'insurance: insurance.count ?? 0',
    'views7d: (views.data ?? []).length',
    'recentLeads: recentLeads.data ?? []',
    'recentLogs,',
  ]) {
    assert.ok(dashboardSource.includes(field), `expected unchanged field: ${field}`);
  }
});

test('9. no analytics/conversion ingest validation schema was touched by this change', () => {
  const schemaSource = readFileSync(join(root, 'src/validation/adminSchemas.ts'), 'utf8');
  assert.match(schemaSource, /export const analyticsIngestSchema = z\.object\(\{/);
  assert.match(schemaSource, /export const conversionIngestSchema = z\.object\(\{/);
  assert.match(schemaSource, /conversion_type: z\.enum\(\['contact', 'newsletter', 'booking_click'\]\)/);
});

test('10. no Production-mutating call (insert/update/delete/upsert) was introduced into the dashboard route', () => {
  assert.doesNotMatch(dashboardSource, /\.insert\(/);
  assert.doesNotMatch(dashboardSource, /\.update\(/);
  assert.doesNotMatch(dashboardSource, /\.delete\(/);
  assert.doesNotMatch(dashboardSource, /\.upsert\(/);
});

test('11. the analytics.controller.ts conversion summary logic (Phase 8 audit scope) is untouched', () => {
  const controllerSource = readFileSync(join(root, 'src/controllers/analytics.controller.ts'), 'utf8');
  assert.match(controllerSource, /const conversionCounts = conversions\.reduce/);
  assert.doesNotMatch(controllerSource, /booking_click/, 'P1-1 (booking-by-path) must not be implemented by this task');
});

// --- Behavioral: the real route still requires auth, unaffected by the query change ---

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

test('12. /api/admin/dashboard still requires authentication (unaffected by the query change)', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/dashboard`);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  } finally {
    server.close();
  }
});
