/**
 * Structural regression tests for the 2026-10-19 analytics-accuracy fix:
 * trackPageView/trackConversion must skip their fetch entirely for
 * excluded traffic — automation tooling (navigator.webdriver, the W3C
 * standard flag Playwright/Puppeteer/Selenium set) and a site owner who
 * has opted their own browser out via the lw_exclude_analytics cookie.
 *
 * Also covers the cookie-setting route handler itself.
 *
 * No network, no browser — source-structure assertions against the real
 * files, following this codebase's established convention.
 *
 *   npx tsx --test scripts/test-analytics-exclusion.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const cmsSourceRaw = readFileSync(join(root, 'src/lib/cms.ts'), 'utf8');
const cmsSource = cmsSourceRaw.replace(/\r\n/g, '\n');

test('1. isExcludedVisitor checks navigator.webdriver', () => {
  assert.match(cmsSource, /navigator\.webdriver/);
});

test('2. isExcludedVisitor checks the lw_exclude_analytics cookie', () => {
  assert.match(cmsSource, /lw_exclude_analytics/);
  assert.match(cmsSource, /document\.cookie/);
});

test('3. trackPageView returns early when isExcludedVisitor() is true, before its try block', () => {
  const fnStart = cmsSource.indexOf('export async function trackPageView');
  const fnBody = cmsSource.slice(fnStart, fnStart + 300);
  assert.match(fnBody, /if \(isExcludedVisitor\(\)\) return;\s*\n\s*try \{/);
});

test('4. trackConversion returns early when isExcludedVisitor() is true, before its try block', () => {
  const fnStart = cmsSource.indexOf('export async function trackConversion');
  const fnBody = cmsSource.slice(fnStart, fnStart + 300);
  assert.match(fnBody, /if \(isExcludedVisitor\(\)\) return;\s*\n\s*try \{/);
});

test('5. the analytics-exclude route handler sets a non-HttpOnly cookie (must be JS-readable by cms.ts)', () => {
  const routeSource = readFileSync(join(root, 'src/app/api/analytics-exclude/route.ts'), 'utf8').replace(
    /\r\n/g,
    '\n'
  );
  assert.match(routeSource, /lw_exclude_analytics/);
  assert.doesNotMatch(routeSource, /httpOnly:\s*true/);
});

test('6. the analytics-exclude route is a GET handler returning plain HTML, not a data-mutating API', () => {
  const routeSource = readFileSync(join(root, 'src/app/api/analytics-exclude/route.ts'), 'utf8');
  assert.match(routeSource, /export async function GET\(/);
  assert.doesNotMatch(routeSource, /export async function (POST|PATCH|PUT|DELETE)\(/);
});
