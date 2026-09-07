/**
 * Regression tests for Phase 8 P3-UTM-1: privacy-safe UTM capture on
 * page_view events (server side).
 *
 * Covers:
 *   - normalizeUtmValue(): trim, lowercase, conservative charset
 *     (letters/digits/hyphen/underscore/period), reject-to-null (never
 *     strip-and-keep) for anything unsafe, length bound matches the
 *     existing analyticsIngestSchema max(120).
 *   - handleAnalyticsIngest independently re-normalizes utm_source/
 *     utm_medium/utm_campaign before insert, rather than trusting the
 *     client-submitted value directly (same trust-boundary discipline as
 *     normalizeReferrerHost for handleConversionIngest).
 *   - An unsafe optional UTM value never fails the whole request — the
 *     page_view still records, just with that field normalized to null.
 *   - referrer_host/device/path/event_type behavior is unchanged.
 *   - conversionIngestSchema (booking_click/contact/newsletter) gained no
 *     UTM fields — P3-UTM-3 is explicitly out of scope for this task.
 *   - No schema/migration file was touched — analytics_events already had
 *     these columns (verified directly against schema.sql, not assumed).
 *
 * Following this codebase's established convention: pure functions
 * (normalizeUtmValue) are imported and executed directly; handleAnalyticsIngest
 * (which needs a live Supabase connection to run at all) is verified via
 * source-structure assertions on the REAL controller source.
 *
 * No live Supabase connection, no Production credentials, no Production
 * mutation, no analytics events created.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-page-view-utm-capture.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeUtmValue } from '../src/lib/attribution.ts';
import { analyticsIngestSchema, conversionIngestSchema } from '../src/validation/adminSchemas.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const controllerSourceRaw = readFileSync(join(root, 'src/controllers/analytics.controller.ts'), 'utf8');
const controllerSource = controllerSourceRaw.replace(/\r\n/g, '\n');
const schemaSql = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');
const opsSql = readFileSync(join(root, 'supabase/ops.sql'), 'utf8');

const ingestFnStart = controllerSource.indexOf('export async function handleAnalyticsIngest');
const ingestFnBody = controllerSource.slice(ingestFnStart, controllerSource.indexOf('\n}', ingestFnStart));

/* ------------------------------------------------- 1-4. capture presence --- */

test('1. analyticsIngestSchema already accepts utm_source (pre-existing, unchanged by this task)', () => {
  assert.equal(analyticsIngestSchema.safeParse({ event_type: 'page_view', utm_source: 'google' }).success, true);
});

test('2. analyticsIngestSchema already accepts utm_medium (pre-existing, unchanged by this task)', () => {
  assert.equal(analyticsIngestSchema.safeParse({ event_type: 'page_view', utm_medium: 'cpc' }).success, true);
});

test('3. analyticsIngestSchema already accepts utm_campaign (pre-existing, unchanged by this task)', () => {
  assert.equal(analyticsIngestSchema.safeParse({ event_type: 'page_view', utm_campaign: 'florida-psychiatry' }).success, true);
});

test('4. handleAnalyticsIngest normalizes all three UTM fields before insert', () => {
  assert.match(ingestFnBody, /utm_source: normalizeUtmValue\(parsed\.data\.utm_source\)/);
  assert.match(ingestFnBody, /utm_medium: normalizeUtmValue\(parsed\.data\.utm_medium\)/);
  assert.match(ingestFnBody, /utm_campaign: normalizeUtmValue\(parsed\.data\.utm_campaign\)/);
  assert.doesNotMatch(ingestFnBody, /\.insert\(parsed\.data\)/, 'must not insert the raw client-submitted object directly');
});

/* ------------------------------------------------- 5-10. valid values --- */

test('5. plain lowercase values pass through unchanged', () => {
  assert.equal(normalizeUtmValue('google'), 'google');
  assert.equal(normalizeUtmValue('cpc'), 'cpc');
});

test('6. values are trimmed', () => {
  assert.equal(normalizeUtmValue('  google  '), 'google');
});

test('7. values are lowercased', () => {
  assert.equal(normalizeUtmValue('Google'), 'google');
  assert.equal(normalizeUtmValue('CPC'), 'cpc');
  assert.equal(normalizeUtmValue('Florida-Psychiatry'), 'florida-psychiatry');
});

test('8. hyphen is allowed', () => {
  assert.equal(normalizeUtmValue('labor-day-2026'), 'labor-day-2026');
});

test('9. underscore is allowed', () => {
  assert.equal(normalizeUtmValue('florida_psychiatry'), 'florida_psychiatry');
});

test('10. period is allowed', () => {
  assert.equal(normalizeUtmValue('newsletter.v2'), 'newsletter.v2');
});

/* ------------------------------------------------- 11-16. unsafe values --- */

test('11. spaces after trim are rejected to null', () => {
  assert.equal(normalizeUtmValue('patient 123'), null);
});

test('12. @ is rejected to null (e.g. an email address)', () => {
  assert.equal(normalizeUtmValue('john@example.com'), null);
});

test('13. slash is rejected to null', () => {
  assert.equal(normalizeUtmValue('hello/world'), null);
});

test('14. colon is rejected to null', () => {
  assert.equal(normalizeUtmValue('diagnosis:adhd'), null);
});

test('15. HTML/script-style characters are rejected to null', () => {
  assert.equal(normalizeUtmValue('<script>'), null);
});

test('16. control characters are rejected to null', () => {
  assert.equal(normalizeUtmValue('evil\ncampaign'), null);
  assert.equal(normalizeUtmValue('evil\tcampaign'), null);
});

/* ------------------------------------------------- 17-18. length/reject style --- */

test('17. a value over 120 characters is rejected to null, consistent with the schema\'s own max(120) bound', () => {
  assert.equal(normalizeUtmValue('a'.repeat(121)), null);
  assert.equal(normalizeUtmValue('a'.repeat(120)), 'a'.repeat(120));
});

test('18. unsafe input is REJECTED to null, never silently stripped and kept as a mutated value', () => {
  // "hello/world" must not become "helloworld" or similar — verified by the
  // exact null result above (test 13), reaffirmed here with a mixed case to
  // guard against a future regex change that starts stripping instead of
  // rejecting.
  assert.notEqual(normalizeUtmValue('hello/world'), 'helloworld');
  assert.equal(normalizeUtmValue('hello/world'), null);
});

/* ------------------------------------------------- 19-21. type safety --- */

test('19. non-string, null, undefined, and empty/whitespace-only values all resolve to null', () => {
  assert.equal(normalizeUtmValue(null), null);
  assert.equal(normalizeUtmValue(undefined), null);
  assert.equal(normalizeUtmValue(12345), null);
  assert.equal(normalizeUtmValue(''), null);
  assert.equal(normalizeUtmValue('   '), null);
});

test('20. an unsafe optional UTM value does not fail the whole page_view request — analyticsIngestSchema itself still validates', () => {
  // The unsafe-charset rejection happens at normalizeUtmValue (the trust
  // boundary in the controller), not at the Zod schema layer — the schema
  // only bounds length/type, matching normalizeReferrerHost's own division
  // of responsibility (schema = first-pass filter, normalizer = authority).
  const parsed = analyticsIngestSchema.safeParse({ event_type: 'page_view', utm_source: 'john@example.com' });
  assert.equal(parsed.success, true);
  assert.equal(normalizeUtmValue(parsed.data.utm_source), null);
});

test('21. the malformed-email example from the task normalizes to null end-to-end (schema accepts, normalizer rejects)', () => {
  const parsed = analyticsIngestSchema.safeParse({ event_type: 'page_view', utm_source: 'john%40example.com'.replace('%40', '@') });
  assert.equal(parsed.success, true);
  assert.equal(normalizeUtmValue(parsed.data.utm_source), null);
});

/* ------------------------------------------------- 22-24. unrelated fields unaffected --- */

test('22. existing referrer_host validation/behavior is unchanged by this task', () => {
  assert.match(controllerSource, /referrer_host: normalizeReferrerHost\(parsed\.data\.referrer_host\)/);
});

test('23. existing device/path/event_type handling is unaffected — analyticsIngestSchema shape unchanged apart from the pre-existing UTM fields', () => {
  assert.deepEqual(
    Object.keys(analyticsIngestSchema.shape).sort(),
    ['device', 'event_type', 'path', 'referrer_host', 'utm_campaign', 'utm_medium', 'utm_source']
  );
});

test('24. handleAnalyticsIngest spreads parsed.data before overriding only the three UTM fields — path/device/event_type pass through untouched', () => {
  assert.match(ingestFnBody, /const payload = \{\s*\n\s*\.\.\.parsed\.data,/);
});

/* ------------------------------------------------- 25-27. conversion protection --- */

test('25. conversionIngestSchema gained no UTM fields — P3-UTM-3 (conversion-level attribution) is not in scope for this task', () => {
  assert.deepEqual(
    Object.keys(conversionIngestSchema.shape).sort(),
    ['conversion_type', 'device', 'meta', 'path', 'referrer_host']
  );
  // Bounded to handleConversionIngest's own body only — NOT to end of file.
  // Phase 8 P3-UTM-2 (a later, separately-authorized task) legitimately
  // added utm_source/utm_campaign to the UNRELATED getAnalyticsSummary
  // function further down this file (page-view UTM traffic reporting, not
  // conversion attribution) — see test-utm-traffic-reporting.mjs for its
  // own coverage. An open-ended "no utm_ from here to EOF" check would
  // incorrectly flag that legitimate, later addition.
  const conversionFnStart = controllerSource.indexOf('export async function handleConversionIngest');
  const conversionFnEnd = controllerSource.indexOf('\n}', conversionFnStart);
  assert.doesNotMatch(controllerSource.slice(conversionFnStart, conversionFnEnd), /utm_/);
});

test('26. booking_click/contact/newsletter conversion types are unaffected — no code path adds UTM fields to a conversion payload', () => {
  const conversionFnStart = controllerSource.indexOf('export async function handleConversionIngest');
  const conversionFnBody = controllerSource.slice(conversionFnStart, controllerSource.indexOf('\n}', conversionFnStart));
  assert.doesNotMatch(conversionFnBody, /utm_source|utm_medium|utm_campaign/);
});

test('27. no Production-mutating call beyond the existing single insert was introduced into handleAnalyticsIngest', () => {
  const insertCount = (ingestFnBody.match(/\.insert\(/g) || []).length;
  assert.equal(insertCount, 1);
  assert.doesNotMatch(ingestFnBody, /\.update\(/);
  assert.doesNotMatch(ingestFnBody, /\.delete\(/);
  assert.doesNotMatch(ingestFnBody, /\.upsert\(/);
});

/* ------------------------------------------------- 28-30. no migration --- */

test('28. analytics_events already has utm_source/utm_medium/utm_campaign columns in the base schema — no migration needed', () => {
  const tableStart = schemaSql.indexOf('create table if not exists analytics_events');
  const tableEnd = schemaSql.indexOf(');', tableStart);
  const tableDef = schemaSql.slice(tableStart, tableEnd);
  assert.match(tableDef, /utm_source text,/);
  assert.match(tableDef, /utm_medium text,/);
  assert.match(tableDef, /utm_campaign text,/);
});

test('29. no new ALTER TABLE for analytics_events UTM columns was added to ops.sql by this task (none needed)', () => {
  assert.doesNotMatch(opsSql, /alter table analytics_events add column if not exists utm_/);
});

test('30. no new table, index, or RLS policy was introduced for this task', () => {
  assert.doesNotMatch(opsSql, /create table if not exists analytics_events/);
  assert.doesNotMatch(opsSql, /create index.*utm/i);
  assert.doesNotMatch(opsSql, /create policy/i);
});

/* ------------------------------------------------- 31. no browser storage server-side reference --- */

test('31. no cookie/session/storage mechanism was introduced anywhere in the analytics controller', () => {
  assert.doesNotMatch(controllerSource, /cookie/i);
  assert.doesNotMatch(controllerSource, /session(?!_start)/i);
  assert.doesNotMatch(controllerSource, /localStorage|sessionStorage/);
});
