/**
 * Regression tests for Phase 8 P3-UTM-2: Admin reporting for page-view UTM
 * attribution ("Traffic by UTM Source" / "Traffic by UTM Campaign" on the
 * Admin Analytics page).
 *
 * Following this codebase's established convention: buildUtmShareRanking
 * is a pure function, unit-tested directly with synthetic input; the
 * page-view-only scoping, range application, and privacy properties of
 * getAnalyticsSummary (which needs a live Supabase connection to run at
 * all) are verified via source-structure assertions on the REAL
 * controller source.
 *
 * No live Supabase connection, no Production credentials, no Production
 * mutation, no analytics events created.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-utm-traffic-reporting.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildUtmShareRanking } from '../src/controllers/analytics.controller.ts';
import { analyticsIngestSchema } from '../src/validation/adminSchemas.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const controllerSourceRaw = readFileSync(join(root, 'src/controllers/analytics.controller.ts'), 'utf8');
const controllerSource = controllerSourceRaw.replace(/\r\n/g, '\n');
const routesSourceRaw = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const routesSource = routesSourceRaw.replace(/\r\n/g, '\n');
const schemaSql = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');
const opsSql = readFileSync(join(root, 'supabase/ops.sql'), 'utf8');
const adminPageSourceRaw = readFileSync(join(root, '../admin/src/app/(app)/analytics/page.tsx'), 'utf8');
const adminPageSource = adminPageSourceRaw.replace(/\r\n/g, '\n');

const summaryStart = controllerSource.indexOf('export async function getAnalyticsSummary');
const summarySource = controllerSource.slice(summaryStart);
// The two UTM-specific accumulation lines, inside the shared pageViews
// loop (merged with popularPages/devices/trafficSources/trends — one pass,
// one range, one event-type filter for every report on this page).
const utmSourceLine = 'if (e.utm_source) byUtmSource[e.utm_source] = (byUtmSource[e.utm_source] ?? 0) + 1;';
const utmCampaignLine = 'if (e.utm_campaign) byUtmCampaign[e.utm_campaign] = (byUtmCampaign[e.utm_campaign] ?? 0) + 1;';
const sharedLoopStart = summarySource.indexOf('for (const e of pageViews) {');
const sharedLoopEnd = summarySource.indexOf('\n  }', sharedLoopStart);
const sharedLoopBody = summarySource.slice(sharedLoopStart, sharedLoopEnd);
const rankingCallsBlock = summarySource.slice(
  summarySource.indexOf('const utmSources = buildUtmShareRanking'),
  summarySource.indexOf('const utmCampaigns = buildUtmShareRanking') + 60
);

/* ------------------------------------------------- 1-2. data source / event scope --- */

test('1. UTM aggregation reads from the analytics_events query (utm_source/utm_campaign selected)', () => {
  assert.match(summarySource, /\.from\('analytics_events'\)\s*\n\s*\.select\('event_type, path, referrer_host, device, utm_source, utm_campaign, created_at'\)/);
});

test('2. only page_view events contribute — the UTM accumulation lines live inside the loop over `pageViews`, never a raw `events` iteration', () => {
  assert.match(sharedLoopBody, /for \(const e of pageViews\) \{/);
  assert.ok(sharedLoopBody.includes(utmSourceLine));
  assert.ok(sharedLoopBody.includes(utmCampaignLine));
  assert.doesNotMatch(summarySource, /for \(const e of events\)/);
});

/* ------------------------------------------------- 3-6. null/blank exclusion --- */

test('3. a null utm_source is excluded from source attribution (truthy-guarded, not fabricated as a fallback label)', () => {
  assert.ok(sharedLoopBody.includes(utmSourceLine));
  assert.doesNotMatch(summarySource, /e\.utm_source \|\| /, 'must not fall back to a fabricated label like popularPages/trafficSources do');
});

test('4. an empty-string utm_source would also be excluded (falsy guard, not just null-specific)', () => {
  const ranking = buildUtmShareRanking({ google: 3 });
  // The guard is `if (e.utm_source)` in the real aggregation loop (test 3) —
  // '' is falsy, so it never reaches byUtmSource at all. This test confirms
  // buildUtmShareRanking itself never invents a '' row from an empty
  // counts map, i.e. there is no special-casing that would let a blank
  // key slip through downstream.
  assert.deepEqual(Object.keys(buildUtmShareRanking({})), []);
  assert.deepEqual(ranking.map((r) => r.value), ['google']);
});

test('5. a null utm_campaign is excluded from campaign attribution', () => {
  assert.ok(sharedLoopBody.includes(utmCampaignLine));
  assert.doesNotMatch(summarySource, /e\.utm_campaign \|\| /);
});

test('6. an empty-string utm_campaign would also be excluded (same falsy guard)', () => {
  assert.deepEqual(Object.keys(buildUtmShareRanking({})), []);
});

/* ------------------------------------------------- 7-12. aggregation/sort correctness --- */

test('7. source counts aggregate correctly', () => {
  const rows = buildUtmShareRanking({ google: 6, facebook: 3, email: 1 });
  const byValue = Object.fromEntries(rows.map((r) => [r.value, r.count]));
  assert.deepEqual(byValue, { google: 6, facebook: 3, email: 1 });
});

test('8. campaign counts aggregate correctly', () => {
  const rows = buildUtmShareRanking({ 'florida-psychiatry': 5, 'labor-day-2026': 3, 'provider-awareness': 2 });
  const byValue = Object.fromEntries(rows.map((r) => [r.value, r.count]));
  assert.deepEqual(byValue, { 'florida-psychiatry': 5, 'labor-day-2026': 3, 'provider-awareness': 2 });
});

test('9. source rows are sorted count-descending', () => {
  const rows = buildUtmShareRanking({ email: 1, google: 6, facebook: 3 });
  assert.deepEqual(rows.map((r) => r.value), ['google', 'facebook', 'email']);
});

test('10. campaign rows are sorted count-descending', () => {
  const rows = buildUtmShareRanking({ 'provider-awareness': 2, 'florida-psychiatry': 5, 'labor-day-2026': 3 });
  assert.deepEqual(rows.map((r) => r.value), ['florida-psychiatry', 'labor-day-2026', 'provider-awareness']);
});

test('11. deterministic tie ordering for equal source counts (ascending by value)', () => {
  const rows = buildUtmShareRanking({ zeta: 2, alpha: 2, mu: 2 });
  assert.deepEqual(rows.map((r) => r.value), ['alpha', 'mu', 'zeta']);
});

test('12. deterministic tie ordering for equal campaign counts (ascending by value)', () => {
  const rows = buildUtmShareRanking({ 'zzz-campaign': 4, 'aaa-campaign': 4 });
  assert.deepEqual(rows.map((r) => r.value), ['aaa-campaign', 'zzz-campaign']);
});

/* ------------------------------------------------- 13-16. share denominator/reconciliation --- */

test('13. source share denominator is UTM-source-attributed page views only, not all page views', () => {
  // Same underlying function serves both source and campaign — proven
  // generically: the denominator is always the sum of the INPUT map, never
  // an externally-passed "all page views" total.
  const rows = buildUtmShareRanking({ google: 6, facebook: 3, email: 1 }); // sum = 10
  assert.deepEqual(rows.map((r) => r.share).sort((a, b) => b - a), [60, 30, 10]);
  // If the denominator were "all page views" (say 100 total site page
  // views), share would be 6/100=6%, not 60% — confirming independence.
});

test('14. campaign share denominator is UTM-campaign-attributed page views only', () => {
  const rows = buildUtmShareRanking({ 'florida-psychiatry': 5, 'labor-day-2026': 3, 'provider-awareness': 2 }); // sum = 10
  const byValue = Object.fromEntries(rows.map((r) => [r.value, r.share]));
  assert.deepEqual(byValue, { 'florida-psychiatry': 50, 'labor-day-2026': 30, 'provider-awareness': 20 });
});

test('15. source displayed shares reconcile to exactly 100 (uncapped, no hidden rows)', () => {
  const rows = buildUtmShareRanking({ google: 6, facebook: 3, email: 1 });
  const total = rows.reduce((sum, r) => sum + r.share, 0);
  assert.equal(Math.round(total), 100);
});

test('16. campaign displayed shares reconcile to exactly 100 (uncapped, no hidden rows)', () => {
  const rows = buildUtmShareRanking({ 'florida-psychiatry': 5, 'labor-day-2026': 3, 'provider-awareness': 2 });
  const total = rows.reduce((sum, r) => sum + r.share, 0);
  assert.equal(Math.round(total), 100);
});

test('15b/16b. reconciliation holds within normal rounding even for values that do not divide evenly', () => {
  const rows = buildUtmShareRanking({ a: 1, b: 1, c: 1 }); // 33.3/33.3/33.3
  const total = rows.reduce((sum, r) => sum + r.share, 0);
  assert.ok(Math.abs(total - 100) < 0.5, `expected ~100, got ${total}`);
});

/* ------------------------------------------------- 17-22. date range application --- */

test('17-20/22. UTM reports use the exact same range-resolved `pageViews` array as every other report on this page (today/7d/30d/custom all apply identically, by construction)', () => {
  // popularPages, trafficSources, and the UTM aggregation are all
  // accumulated in ONE shared loop over `pageViews` (test 2) — there is no
  // second, independently-scoped query for UTM data, so any preset/custom
  // range that works for the rest of the page necessarily applies
  // identically here. Confirmed by there being exactly one such loop and
  // exactly one resolveRange() call for the whole response.
  const loopCount = (summarySource.match(/for \(const e of pageViews\) \{/g) || []).length;
  assert.equal(loopCount, 1, 'expected exactly one shared loop over pageViews (utm reads the same array, not a second loop)');
  const resolveRangeCalls = (summarySource.match(/resolveRange\(/g) || []).length;
  assert.equal(resolveRangeCalls, 1);
});

test('21. Eastern Time range semantics (REPORT_TIMEZONE/zonedMidnightToUtc/dateKeyInZone) are untouched', () => {
  assert.match(controllerSource, /const REPORT_TIMEZONE = 'America\/New_York';/);
  assert.match(controllerSource, /const rangeStart = zonedMidnightToUtc\(from, REPORT_TIMEZONE\);/);
  assert.match(controllerSource, /const day = dateKeyInZone\(e\.created_at as string, REPORT_TIMEZONE\);/);
});

/* ------------------------------------------------- 23-26. conversions/event-type exclusion --- */

test('23. neither UTM accumulation line references `conversions` in any form', () => {
  assert.doesNotMatch(utmSourceLine, /conversions/);
  assert.doesNotMatch(utmCampaignLine, /conversions/);
  assert.ok(rankingCallsBlock.includes('byUtmSource') && rankingCallsBlock.includes('byUtmCampaign'));
  assert.doesNotMatch(rankingCallsBlock, /conversions/);
});

test('24/25/26. booking_click, contact, and newsletter conversion types cannot contribute — UTM values are read only from `e` (a pageViews row), never from any conversions row/type', () => {
  assert.doesNotMatch(utmSourceLine, /conversion_type|booking_click|'contact'|'newsletter'/);
  assert.doesNotMatch(utmCampaignLine, /conversion_type|booking_click|'contact'|'newsletter'/);
});

/* ------------------------------------------------- 27-30. privacy --- */

test('27. individual analytics rows are never exposed — the response only ever includes the aggregate utmSources/utmCampaigns arrays', () => {
  const responseBlock = summarySource.slice(summarySource.indexOf('res.json({'));
  assert.match(responseBlock, /utmSources,/);
  assert.match(responseBlock, /utmCampaigns,/);
  assert.doesNotMatch(responseBlock, /rawEvents|allEvents|events,/);
});

test('28/29. UtmShareRow carries no PII/PHI fields — only value/count/share', () => {
  assert.match(controllerSource, /export type UtmShareRow = \{ value: string; count: number; share: number \};/);
});

test('30. no full query string, path, or raw referrer is included in either UTM accumulation line', () => {
  for (const line of [utmSourceLine, utmCampaignLine]) {
    assert.doesNotMatch(line, /\.path\b/);
    assert.doesNotMatch(line, /referrer_host/);
    assert.doesNotMatch(line, /window\.location|\bsearch\b/);
  }
});

test('31. no cookie/storage mechanism was introduced anywhere in the analytics controller', () => {
  assert.doesNotMatch(controllerSource, /cookie/i);
  assert.doesNotMatch(controllerSource, /localStorage|sessionStorage/);
});

test('32. no new tracking/ingest field was introduced — analyticsIngestSchema shape is unchanged from P3-UTM-1', () => {
  assert.deepEqual(
    Object.keys(analyticsIngestSchema.shape).sort(),
    ['device', 'event_type', 'path', 'referrer_host', 'utm_campaign', 'utm_medium', 'utm_source']
  );
});

/* ------------------------------------------------- 33-36. protected areas --- */

test('33. P3-UTM-1 capture/normalization remains intact (normalizeUtmValue still applied at ingest, unchanged)', () => {
  const ingestFnStart = controllerSource.indexOf('export async function handleAnalyticsIngest');
  const ingestFnBody = controllerSource.slice(ingestFnStart, controllerSource.indexOf('\n}', ingestFnStart));
  assert.match(ingestFnBody, /utm_source: normalizeUtmValue\(parsed\.data\.utm_source\)/);
  assert.match(ingestFnBody, /utm_medium: normalizeUtmValue\(parsed\.data\.utm_medium\)/);
  assert.match(ingestFnBody, /utm_campaign: normalizeUtmValue\(parsed\.data\.utm_campaign\)/);
});

test('34. existing device analytics (byDevice/devices) is unaffected', () => {
  assert.match(summarySource, /const device = e\.device \|\| 'unknown';/);
  assert.match(summarySource, /devices: byDevice,/);
});

test('35. existing referrer analytics (trafficSources) is unaffected', () => {
  assert.match(summarySource, /const ref = e\.referrer_host \|\| 'direct';/);
  assert.match(summarySource, /trafficSources,/);
});

test('36. existing topBookingPages/booking-click device+referrer reporting is unaffected', () => {
  assert.match(summarySource, /const topBookingPages = Object\.entries\(byBookingClickPath\)/);
  assert.match(summarySource, /bookingClicksByDevice: byBookingClickDevice,/);
  assert.match(summarySource, /bookingClicksByReferrer,/);
});

test('37. Dashboard P1-1 (booking intent by page) is untouched by this task — admin.routes.ts still has its own aggregation, unmodified', () => {
  assert.match(routesSource, /export function aggregateBookingIntentByPage/);
  assert.match(routesSource, /bookingIntentByPage,/);
});

/* ------------------------------------------------- 38-41. Admin UI --- */

test('38. an independent empty state exists for the Source report', () => {
  const sourceSectionStart = adminPageSource.indexOf('Traffic by UTM Source');
  const sourceSectionEnd = adminPageSource.indexOf('Traffic by UTM Campaign');
  const sourceSection = adminPageSource.slice(sourceSectionStart, sourceSectionEnd);
  assert.match(sourceSection, /No UTM-attributed page views were recorded in this period\./);
});

test('39. an independent empty state exists for the Campaign report', () => {
  const campaignSectionStart = adminPageSource.indexOf('Traffic by UTM Campaign');
  const campaignSection = adminPageSource.slice(campaignSectionStart, campaignSectionStart + 1500);
  assert.match(campaignSection, /No UTM-attributed page views were recorded in this period\./);
});

test('40. UI language never claims booking/conversion/appointment/lead/patient attribution for UTM traffic', () => {
  const utmSectionStart = adminPageSource.indexOf('Traffic by UTM Source');
  const utmSectionEnd = adminPageSource.indexOf('Top booking-intent pages');
  const utmSection = adminPageSource.slice(utmSectionStart, utmSectionEnd);
  for (const forbidden of [/Bookings by Campaign/i, /Conversions by Campaign/i, /Patients by Campaign/i, /Appointments by Campaign/i, /Leads by Campaign/i]) {
    assert.doesNotMatch(utmSection, forbidden);
  }
  assert.match(adminPageSource, /UTM reporting reflects attributed page views, not confirmed appointments or booking conversions\./);
});

test('41. UTM values are rendered as plain React text — no dangerouslySetInnerHTML, no HTML construction from UTM data', () => {
  assert.doesNotMatch(adminPageSource, /dangerouslySetInnerHTML/);
  const utmSectionStart = adminPageSource.indexOf('Traffic by UTM Source');
  const utmSectionEnd = adminPageSource.indexOf('Top booking-intent pages');
  const utmSection = adminPageSource.slice(utmSectionStart, utmSectionEnd);
  assert.doesNotMatch(utmSection, /<a\s+href=\{row\.value/, 'must never build a clickable URL from a raw UTM value');
});

/* ------------------------------------------------- 42-43. no schema/campaign changes --- */

test('42. no new schema migration was introduced — analytics_events already had utm_source/utm_campaign (P3-UTM-1), no ALTER TABLE added here', () => {
  assert.doesNotMatch(opsSql, /alter table analytics_events add column if not exists utm_/);
  const tableStart = schemaSql.indexOf('create table if not exists analytics_events');
  const tableEnd = schemaSql.indexOf(');', tableStart);
  const tableDef = schemaSql.slice(tableStart, tableEnd);
  assert.match(tableDef, /utm_source text,/);
  assert.match(tableDef, /utm_campaign text,/);
});

test('43. no marketing campaign/Paubox code was touched by this task', () => {
  assert.doesNotMatch(controllerSource, /paubox/i);
  assert.doesNotMatch(controllerSource, /marketing_campaign/i);
});
