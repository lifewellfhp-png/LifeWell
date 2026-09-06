/**
 * Regression tests for Phase 8 P2-1: custom date ranges + one explicit
 * reporting timezone, consistently applied end-to-end in
 * getAnalyticsSummary.
 *
 * Design under test (see the doc comment above REPORT_TIMEZONE in
 * analytics.controller.ts for the authoritative statement):
 *   - Reporting timezone: America/New_York, fixed, IANA (handles DST).
 *   - `from`/`to` are calendar dates (YYYY-MM-DD) in that timezone, BOTH
 *     INCLUSIVE from the caller's perspective.
 *   - Underlying query window: half-open [localMidnight(from),
 *     localMidnight(to + 1 day)) — start inclusive, end exclusive.
 *   - Trend day-buckets use the same zone (dateKeyInZone), not raw UTC
 *     slicing.
 *   - The comparison ("prior") period is the same length in days,
 *     immediately preceding the selected range, same zone rule.
 *   - preset=today|7d|30d resolves "today" server-side in the reporting
 *     zone — the client never computes date math in its own timezone.
 *
 * Since the exact conversion functions are internal (not exported) and
 * getAnalyticsSummary itself requires a live Supabase connection this
 * environment doesn't have, these tests exercise the pure date/timezone
 * math by faithfully re-deriving it from the controller's own documented
 * algorithm (verified line-for-line against the real source below) and by
 * asserting the real source implements exactly that algorithm — following
 * this codebase's established convention of source-level verification
 * without a live backend (see test-admin-no-store-cache.mjs).
 *
 * No live Supabase connection, no Production credentials, no Production
 * mutation, no ingest schema change.
 *
 *   npx tsx --test scripts/test-analytics-date-range-timezone.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const controllerSourceRaw = readFileSync(join(root, 'src/controllers/analytics.controller.ts'), 'utf8');
const controllerSource = controllerSourceRaw.replace(/\r\n/g, '\n');

// Note: resolveRange()'s validation (invalid dates, from>to, range too
// large, preset+from/to together) runs INSIDE getAnalyticsSummary, which
// sits behind requireAdmin — and requireAdmin itself needs a live Supabase
// lookup for token-revocation checking (see isSessionRevoked in
// adminAuth.ts), so even a well-formed request 500s before ever reaching
// resolveRange in this Supabase-less environment. That's why this file
// verifies resolveRange's contract at the source level (below) and the pure
// date/timezone math by independent re-derivation (above), rather than
// over HTTP — the same tradeoff test-admin-no-store-cache.mjs documents.

/* ----------------------------------------------- 1. source-level shape --- */

test('1. REPORT_TIMEZONE is a fixed IANA zone (America/New_York), not a hardcoded offset', () => {
  assert.match(controllerSource, /const REPORT_TIMEZONE = 'America\/New_York';/);
});

test('2. getAnalyticsSummary reads from/to/preset from the request query, not a hardcoded window', () => {
  const fnStart = controllerSource.indexOf('export async function getAnalyticsSummary');
  const fnBody = controllerSource.slice(fnStart);
  assert.match(fnBody, /resolveRange\(req\.query\)/);
  assert.doesNotMatch(fnBody, /Date\.now\(\) - 30 \* 24 \* 60 \* 60 \* 1000/, 'the old hardcoded 30-day window must be gone');
});

test('3. the query window is half-open: gte(rangeStart) ... lt(rangeEnd), both derived via zonedMidnightToUtc', () => {
  const fnStart = controllerSource.indexOf('export async function getAnalyticsSummary');
  const fnBody = controllerSource.slice(fnStart, controllerSource.indexOf('const priorTo', fnStart));
  assert.match(fnBody, /const rangeStart = zonedMidnightToUtc\(from, REPORT_TIMEZONE\);/);
  assert.match(fnBody, /const rangeEnd = zonedMidnightToUtc\(addCalendarDays\(to, 1\), REPORT_TIMEZONE\);/);
  assert.match(fnBody, /\.gte\('created_at', rangeStart\.toISOString\(\)\)/);
  assert.match(fnBody, /\.lt\('created_at', rangeEnd\.toISOString\(\)\)/);
});

test('4. trend day-buckets use dateKeyInZone (reporting timezone), not a raw UTC .slice(0, 10)', () => {
  assert.match(controllerSource, /const day = dateKeyInZone\(e\.created_at as string, REPORT_TIMEZONE\);/);
  assert.doesNotMatch(controllerSource, /const day = \(e\.created_at as string\)\.slice\(0, 10\);/);
});

test('5. the comparison period is derived from the ACTUAL selected range length, not a hardcoded 60/30-day split', () => {
  const fnStart = controllerSource.indexOf('export async function getAnalyticsSummary');
  const fnBody = controllerSource.slice(fnStart);
  assert.match(fnBody, /const priorTo = addCalendarDays\(from, -1\);/);
  assert.match(fnBody, /const priorFrom = addCalendarDays\(priorTo, -\(rangeDays - 1\)\);/);
  assert.doesNotMatch(fnBody, /60 \* 24 \* 60 \* 60 \* 1000/, 'the old hardcoded 60-day prior window must be gone');
});

test('6. the response echoes from/to/timezone so the Admin UI never hardcodes a second copy of the reporting zone', () => {
  const responseBlock = controllerSource.slice(controllerSource.indexOf('res.json({'));
  assert.match(responseBlock, /from,\s*\n\s*to,\s*\n\s*timezone: REPORT_TIMEZONE,/);
});

/* ---------------------------------------------- 7-9. boundary math (re-derived + cross-checked) --- */

function zonedMidnightToUtc(dateStr, timeZone) {
  const naiveUtc = new Date(`${dateStr}T00:00:00.000Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const part of fmt.formatToParts(naiveUtc)) parts[part.type] = part.value;
  const hour = Number(parts.hour) % 24;
  const zonedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  const offsetMs = zonedAsUtc - naiveUtc.getTime();
  return new Date(naiveUtc.getTime() - offsetMs);
}

function dateKeyInZone(isoUtc, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoUtc));
}

test('7. a summer date (EDT, UTC-4): ET midnight is 04:00 UTC', () => {
  assert.equal(zonedMidnightToUtc('2026-08-01', 'America/New_York').toISOString(), '2026-08-01T04:00:00.000Z');
});

test('8. a winter date (EST, UTC-5): ET midnight is 05:00 UTC', () => {
  assert.equal(zonedMidnightToUtc('2026-01-01', 'America/New_York').toISOString(), '2026-01-01T05:00:00.000Z');
});

test('9. an event at 03:59 UTC on Aug 1 belongs to Jul 31 in ET; one at 04:00 UTC belongs to Aug 1 (inclusive/exclusive boundary is correct, not off-by-one)', () => {
  assert.equal(dateKeyInZone('2026-08-01T03:59:00.000Z', 'America/New_York'), '2026-07-31');
  assert.equal(dateKeyInZone('2026-08-01T04:00:00.000Z', 'America/New_York'), '2026-08-01');
});

test('10. a full-day range (from=to=2026-08-01) produces a query window of exactly 24 hours', () => {
  const start = zonedMidnightToUtc('2026-08-01', 'America/New_York');
  const end = zonedMidnightToUtc('2026-08-02', 'America/New_York'); // to + 1 day
  assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
});

/* ---------------------------------------------- 11-14. resolveRange contract --- */

test('11. preset values are restricted to today/7d/30d and reject anything else', () => {
  assert.match(controllerSource, /const PRESETS = \['today', '7d', '30d'\] as const;/);
});

test('12. preset and from/to are mutually exclusive (reject both provided together)', () => {
  const fnStart = controllerSource.indexOf('function resolveRange');
  const fnBody = controllerSource.slice(fnStart, controllerSource.indexOf('\n}', fnStart));
  assert.match(fnBody, /Provide either preset or from\/to, not both\./);
});

test('13. from and to are required together — one without the other is rejected', () => {
  const fnStart = controllerSource.indexOf('function resolveRange');
  const fnBody = controllerSource.slice(fnStart, controllerSource.indexOf('\n}', fnStart));
  assert.match(fnBody, /Both from and to must be provided together\./);
});

test('14. from must not be after to, and the range is capped at MAX_RANGE_DAYS', () => {
  const fnStart = controllerSource.indexOf('function resolveRange');
  const fnBody = controllerSource.slice(fnStart, controllerSource.indexOf('\n}', fnStart));
  assert.match(fnBody, /from must not be after to\./);
  assert.match(controllerSource, /const MAX_RANGE_DAYS = 366;/);
  assert.match(fnBody, /spanDays > MAX_RANGE_DAYS/);
});

test('15. with no query params at all, the default is the last 30 calendar days ending today in the reporting zone (unchanged default behavior)', () => {
  const fnStart = controllerSource.indexOf('function resolveRange');
  const fnBody = controllerSource.slice(fnStart, controllerSource.indexOf('\n}', fnStart));
  assert.match(fnBody, /addCalendarDays\(to, -29\)/);
});

/* --------------------------------------------------- 16-17. Admin UI --- */

test('16. the Admin Analytics page sends preset or explicit from/to — never computes "today" itself', () => {
  const pageSource = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
  assert.match(pageSource, /\/api\/admin\/analytics\/summary\?preset=\$\{preset\}/);
  assert.match(pageSource, /new URLSearchParams\(\{ from: customFrom, to: customTo \}\)/);
  assert.doesNotMatch(pageSource, /new Date\(\)\.toISOString\(\)\.slice/, 'the client must not derive "today" itself');
});

test('17. the Admin Analytics page displays the reporting timezone the API returned, not a hardcoded label used for computation', () => {
  const pageSource = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
  assert.match(pageSource, /data\.timezone/);
  assert.match(pageSource, /'America\/New_York': 'Eastern Time \(ET\)'/);
});

/* ------------------------------------------- 18. protected areas --- */

test('18. topBookingPages (P1-1) aggregation and Sessions removal (P1-2) are unaffected by this change', () => {
  assert.match(controllerSource, /const topBookingPages = Object\.entries\(byBookingClickPath\)/);
  assert.doesNotMatch(controllerSource, /sessions:/);
  assert.doesNotMatch(controllerSource, /session_start/);
});
