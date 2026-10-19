/**
 * Structural regression test for the 2026-10-19 analytics-accuracy fix:
 * getAnalyticsSummary must call the analytics_summary() Postgres RPC
 * function instead of a plain .select() on analytics_events/conversions.
 *
 * A plain .select() with no .range() is capped at PostgREST's default
 * 1000 rows — that cap is what originally made Admin Analytics show
 * suspiciously round numbers (page views = 1000, "+0% vs prior period").
 * This grep-for-absence test exists so that cap can never silently
 * reappear if this function is edited again later.
 *
 * No live Supabase connection, no Production credentials.
 *
 *   npx tsx --test scripts/test-analytics-rpc-wiring.mjs
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

const summaryStart = controllerSource.indexOf('export async function getAnalyticsSummary');
const summarySource = controllerSource.slice(summaryStart);

test('1. getAnalyticsSummary calls the analytics_summary RPC function', () => {
  assert.ok(summaryStart > -1, 'expected to find getAnalyticsSummary');
  assert.match(summarySource, /sb\.rpc\('analytics_summary',\s*\{/);
  assert.match(summarySource, /p_from:\s*from,/);
  assert.match(summarySource, /p_to:\s*to,/);
  assert.match(summarySource, /p_tz:\s*REPORT_TIMEZONE,/);
});

test('2. getAnalyticsSummary no longer calls a plain, uncapped .select() on analytics_events or conversions', () => {
  assert.doesNotMatch(summarySource, /\.from\('analytics_events'\)\s*\n\s*\.select\(/);
  assert.doesNotMatch(summarySource, /\.from\('conversions'\)\s*\n\s*\.select\(/);
});

test('3. the migration file creating the RPC function exists and is additive-only (no DROP TABLE, no destructive DDL)', () => {
  const migrationSource = readFileSync(
    join(root, 'supabase/migrations/20261019180354_analytics_summary_rpc.sql'),
    'utf8'
  );
  assert.match(migrationSource, /create or replace function analytics_summary\(/);
  assert.doesNotMatch(migrationSource, /drop table/i);
  assert.doesNotMatch(migrationSource, /^\s*truncate\s/im);
  assert.doesNotMatch(migrationSource, /delete from/i);
});

test('4. the RPC function only ever reads (no insert/update/delete inside the function body)', () => {
  const migrationSource = readFileSync(
    join(root, 'supabase/migrations/20261019180354_analytics_summary_rpc.sql'),
    'utf8'
  );
  const fnStart = migrationSource.indexOf('create or replace function analytics_summary(');
  const fnEnd = migrationSource.indexOf('$$;', fnStart);
  const fnBody = migrationSource.slice(fnStart, fnEnd);
  assert.doesNotMatch(fnBody, /\binsert into\b/i);
  assert.doesNotMatch(fnBody, /\bupdate\s+\w+\s+set\b/i);
  assert.doesNotMatch(fnBody, /\bdelete from\b/i);
});

test('5. EXECUTE on the function is restricted to service_role, matching this schema’s default-deny convention', () => {
  const migrationSource = readFileSync(
    join(root, 'supabase/migrations/20261019180354_analytics_summary_rpc.sql'),
    'utf8'
  );
  assert.match(migrationSource, /revoke execute on function analytics_summary\(date, date, text\) from public;/);
  assert.match(migrationSource, /grant execute on function analytics_summary\(date, date, text\) to service_role;/);
});
