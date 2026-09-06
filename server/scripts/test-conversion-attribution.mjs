/**
 * Regression tests for Phase 8 P3-1: privacy-minimized device/referrer
 * attribution for conversion events (server side).
 *
 * Covers:
 *   - The additive migration in server/supabase/ops.sql (nullable columns,
 *     idempotent, CHECK constraint reuses the same enum as
 *     analytics_events.device, documented manual rollback).
 *   - normalizeReferrerHost(): proper URL parsing, lowercase + trailing-dot
 *     stripping, rejection of paths/queries/fragments/credentials/ports/
 *     control characters/oversized input, safe-by-default (null) on any
 *     malformed input.
 *   - conversionIngestSchema accepts the new optional fields and reuses the
 *     same device enum as analyticsIngestSchema (no divergent vocabulary).
 *   - handleConversionIngest passes device through and independently
 *     re-normalizes referrer_host rather than trusting the client.
 *   - getAnalyticsSummary's new booking-click device/referrer aggregation is
 *     additive and does not alter existing totals/date-range/ET-bucketing/
 *     comparison-period logic (P1-1/P1-2/P2-1 must not regress).
 *   - No raw user-agent, IP, or full referrer URL is ever read, stored, or
 *     forwarded.
 *
 * Following this codebase's established convention of testing real
 * production code without a live Supabase connection — pure functions
 * (normalizeReferrerHost) are imported and executed directly; everything
 * that requires Supabase is verified at the source level (see
 * test-admin-no-store-cache.mjs for why).
 *
 * No live Supabase connection, no Production credentials, no Production
 * mutation.
 *
 *   npx tsx --test scripts/test-conversion-attribution.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeReferrerHost } from '../src/lib/attribution.ts';
import { conversionIngestSchema, analyticsIngestSchema } from '../src/validation/adminSchemas.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const opsSql = readFileSync(join(root, 'supabase/ops.sql'), 'utf8');
const controllerSourceRaw = readFileSync(join(root, 'src/controllers/analytics.controller.ts'), 'utf8');
const controllerSource = controllerSourceRaw.replace(/\r\n/g, '\n');

/* ------------------------------------------------------- 1-5. migration --- */

test('1. ops.sql adds both columns idempotently (IF NOT EXISTS), additive only', () => {
  assert.match(opsSql, /alter table conversions add column if not exists device text/);
  assert.match(opsSql, /alter table conversions add column if not exists referrer_host text/);
});

test('2. both new columns are nullable — no NOT NULL, no default that would rewrite existing rows', () => {
  const deviceLine = opsSql.match(/alter table conversions add column if not exists device text[\s\S]{0,120}?;/)[0];
  const referrerLine = opsSql.match(/alter table conversions add column if not exists referrer_host text;/)[0];
  assert.doesNotMatch(deviceLine, /not null/i);
  assert.doesNotMatch(referrerLine, /not null/i);
  assert.doesNotMatch(referrerLine, /default/i);
});

test('3. device reuses the exact same closed vocabulary as analytics_events.device (no divergent enum)', () => {
  const deviceCheck = opsSql.match(/alter table conversions add column if not exists device text[\s\S]{0,120}?;/)[0];
  assert.match(deviceCheck, /check \(device is null or device in \('mobile', 'tablet', 'desktop', 'unknown'\)\)/);
  const schemaSql = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');
  assert.match(schemaSql, /device in \('mobile', 'tablet', 'desktop', 'unknown'\)/);
});

test('4. a documented manual rollback (drop column) exists, matching this schema\'s "no automated down-migration" convention', () => {
  assert.match(opsSql, /alter table conversions drop column if exists device;/);
  assert.match(opsSql, /alter table conversions drop column if exists referrer_host;/);
  // Must be commented out (informational), never an active statement that
  // would run automatically alongside the additive statements above.
  const rollbackIdx = opsSql.indexOf('alter table conversions drop column if exists device;');
  const linesBefore = opsSql.slice(0, rollbackIdx).split('\n');
  const lineText = linesBefore[linesBefore.length - 1] + 'alter table conversions drop column if exists device;';
  assert.match(lineText, /^--/, 'the rollback statement must be commented out, not executable');
});

test('5. no destructive statement (DROP TABLE, DROP COLUMN outside the documented rollback comment, TRUNCATE, DELETE) touches conversions', () => {
  const conversionsSectionStart = opsSql.indexOf('Phase 8 P3-1');
  const section = opsSql.slice(conversionsSectionStart);
  assert.doesNotMatch(section, /drop table/i);
  assert.doesNotMatch(section, /truncate/i);
  assert.doesNotMatch(section, /delete from conversions/i);
  // The only "drop column" occurrences must be inside the commented rollback block.
  const activeDropColumn = section
    .split('\n')
    .filter((line) => /drop column/i.test(line) && !line.trim().startsWith('--'));
  assert.equal(activeDropColumn.length, 0, 'drop column must only appear in the commented rollback block');
});

/* ------------------------------------------- 6-16. normalizeReferrerHost --- */

test('6. valid https referrer hosts pass through unchanged', () => {
  assert.equal(normalizeReferrerHost('google.com'), 'google.com');
  assert.equal(normalizeReferrerHost('www.lifewellfhp.com'), 'www.lifewellfhp.com');
  assert.equal(normalizeReferrerHost('facebook.com'), 'facebook.com');
});

test('7. casing is normalized to lowercase', () => {
  assert.equal(normalizeReferrerHost('GOOGLE.com'), 'google.com');
  assert.equal(normalizeReferrerHost('Www.LifeWellFHP.com'), 'www.lifewellfhp.com');
});

test('8. a trailing dot is stripped', () => {
  assert.equal(normalizeReferrerHost('google.com.'), 'google.com');
});

test('9. a path, query string, or fragment causes rejection to null (never stored)', () => {
  assert.equal(normalizeReferrerHost('evil.com/path'), null);
  assert.equal(normalizeReferrerHost('evil.com?q=search+term'), null);
  assert.equal(normalizeReferrerHost('evil.com#fragment'), null);
});

test('10. credentials and a nonstandard port cause rejection to null (never retained)', () => {
  assert.equal(normalizeReferrerHost('user:pass@evil.com'), null);
  assert.equal(normalizeReferrerHost('evil.com:8080'), null);
});

test('11. a non-hostname scheme-like value (e.g. an XSS attempt) fails safely to null, never throws', () => {
  assert.doesNotThrow(() => normalizeReferrerHost('javascript:alert(1)'));
  assert.equal(normalizeReferrerHost('javascript:alert(1)'), null);
});

test('12. embedded control characters (e.g. newline, tab) are rejected outright, not silently stripped', () => {
  // A naive URL-parser-only implementation would silently strip these
  // (WHATWG URL behavior) rather than reject — this is the specific gap the
  // charset pre-filter closes.
  assert.equal(normalizeReferrerHost('evil\ncom'), null);
  assert.equal(normalizeReferrerHost('evil\tcom'), null);
});

test('13. empty, whitespace-only, non-string, null, and undefined values all resolve to null', () => {
  assert.equal(normalizeReferrerHost(''), null);
  assert.equal(normalizeReferrerHost('   '), null);
  assert.equal(normalizeReferrerHost(null), null);
  assert.equal(normalizeReferrerHost(undefined), null);
  assert.equal(normalizeReferrerHost(12345), null);
});

test('14. an excessively long value is rejected rather than silently truncated', () => {
  assert.equal(normalizeReferrerHost('a'.repeat(260) + '.com'), null);
  // A realistically long but valid hostname must still be accepted.
  const longButValid = 'a'.repeat(60) + '.example.com';
  assert.equal(normalizeReferrerHost(longButValid), longButValid);
});

test('15. an IP-literal host is accepted as-is (not identifying/sensitive on its own, not something this task asked to special-case)', () => {
  assert.equal(normalizeReferrerHost('192.168.1.5'), '192.168.1.5');
});

test('16. normalizeReferrerHost never derives a hostname via fragile string splitting (uses the URL constructor)', () => {
  const src = readFileSync(join(root, 'src/lib/attribution.ts'), 'utf8');
  assert.match(src, /new URL\(/);
  assert.doesNotMatch(src, /\.split\('\/'\)/);
  assert.doesNotMatch(src, /\.replace\(.*https?:\/\//);
});

/* -------------------------------------------- 17-20. schema reuse --- */

test('17. conversionIngestSchema accepts the same device enum as analyticsIngestSchema (shared, not divergent)', () => {
  for (const value of ['mobile', 'tablet', 'desktop', 'unknown']) {
    assert.equal(conversionIngestSchema.safeParse({ conversion_type: 'booking_click', device: value }).success, true);
    assert.equal(analyticsIngestSchema.safeParse({ event_type: 'page_view', device: value }).success, true);
  }
  assert.equal(conversionIngestSchema.safeParse({ conversion_type: 'booking_click', device: 'smart-fridge' }).success, false);
});

test('18. conversionIngestSchema accepts a missing device/referrer_host (backward compatible with existing call sites/tests)', () => {
  const result = conversionIngestSchema.safeParse({ conversion_type: 'contact', path: '/contact' });
  assert.equal(result.success, true);
});

test('19. conversionIngestSchema rejects an absurdly long referrer_host at the schema layer (defense in depth ahead of normalizeReferrerHost)', () => {
  const result = conversionIngestSchema.safeParse({
    conversion_type: 'booking_click',
    referrer_host: 'a'.repeat(300),
  });
  assert.equal(result.success, false);
});

test('20. handleConversionIngest independently re-normalizes referrer_host rather than trusting the client-submitted value directly', () => {
  const fnStart = controllerSource.indexOf('export async function handleConversionIngest');
  const fnBody = controllerSource.slice(fnStart, controllerSource.indexOf('\n}', fnStart));
  assert.match(fnBody, /referrer_host: normalizeReferrerHost\(parsed\.data\.referrer_host\)/);
  assert.doesNotMatch(fnBody, /referrer_host: parsed\.data\.referrer_host,?\s*\n/, 'must not insert the raw submitted value directly');
});

/* ------------------------------------ 21-24. getAnalyticsSummary aggregation --- */

test('21. getAnalyticsSummary now selects device/referrer_host from conversions and aggregates booking_click by both', () => {
  const summaryStart = controllerSource.indexOf('export async function getAnalyticsSummary');
  const summaryBody = controllerSource.slice(summaryStart, controllerSource.indexOf('res.json({', summaryStart));
  assert.match(summaryBody, /\.from\('conversions'\)\s*\n\s*\.select\('conversion_type, path, device, referrer_host, created_at'\)/);
  assert.match(summaryBody, /if \(c\.conversion_type !== 'booking_click'\) continue;[\s\S]*?byBookingClickDevice/);
  assert.match(summaryBody, /const ref = c\.referrer_host \|\| 'direct';/);
  assert.match(summaryBody, /const device = c\.device \|\| 'unknown';/);
});

test('22. the response includes the new fields additively — nothing existing was removed', () => {
  const responseBlock = controllerSource.slice(controllerSource.indexOf('res.json({'));
  for (const field of [
    'from,', 'to,', 'timezone: REPORT_TIMEZONE,', 'rangeDays,',
    'popularPages,', 'devices: byDevice,', 'trafficSources,', 'trends,',
    'conversionCounts,', 'topBookingPages,',
    'bookingClicksByDevice: byBookingClickDevice,', 'bookingClicksByReferrer,',
  ]) {
    assert.ok(responseBlock.includes(field), `expected response to include: ${field}`);
  }
});

test('23. P2-1 date-range/ET-bucketing/comparison-period logic is untouched by this change', () => {
  assert.match(controllerSource, /const REPORT_TIMEZONE = 'America\/New_York';/);
  assert.match(controllerSource, /const rangeStart = zonedMidnightToUtc\(from, REPORT_TIMEZONE\);/);
  assert.match(controllerSource, /const day = dateKeyInZone\(e\.created_at as string, REPORT_TIMEZONE\);/);
  assert.match(controllerSource, /const priorFrom = addCalendarDays\(priorTo, -\(rangeDays - 1\)\);/);
});

test('24. P1-2 Sessions removal is not reintroduced by this change', () => {
  assert.doesNotMatch(controllerSource, /sessions:/);
  assert.doesNotMatch(controllerSource, /session_start/);
});

/* ------------------------------------------------- 26-28. Admin UI --- */

test('26. the Admin Analytics page reads the new fields and renders them via existing chart components (no new chart library)', () => {
  const pageSource = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
  assert.match(pageSource, /bookingClicksByDevice: Record<string, number>;/);
  assert.match(pageSource, /bookingClicksByReferrer: \{ source: string; visits: number \}\[\];/);
  assert.match(pageSource, /<DonutChart[\s\S]{0,300}bookingDevices/);
  assert.match(pageSource, /<BarList points=\{bookingReferrers\}/);
});

test('27. the Admin UI explains "Unknown"/"Direct" as legacy/attribution-free rows rather than leaving them unexplained', () => {
  const pageSource = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
  assert.match(pageSource, /"Unknown" includes clicks recorded before device attribution existed\./);
  assert.match(pageSource, /"Direct" includes clicks with no referrer and clicks recorded before referrer attribution existed\./);
});

test('28. no new KPI card was added merely to expose the columns — only chart sections reusing existing components', () => {
  const pageSource = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
  const kpiCardCount = (pageSource.match(/className="kpi-card static"/g) || []).length;
  assert.equal(kpiCardCount, 2, 'expected exactly the existing 2 KPI cards (Page views, Conversions) — P3-1 must not add a new one');
});

/* ---------------------------------------------- 25. no raw sensitive data --- */

test('25. no raw user-agent header, IP address, or full-URL variable is read or forwarded anywhere in the controller', () => {
  assert.doesNotMatch(controllerSource, /user-agent/i);
  assert.doesNotMatch(controllerSource, /req\.ip\b/);
  assert.doesNotMatch(controllerSource, /x-forwarded-for/i);
  assert.doesNotMatch(controllerSource, /req\.headers/);
});
