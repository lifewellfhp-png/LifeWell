/**
 * Real-browser CSP smoke test (Phase 1 follow-up). Everything else in this
 * directory is a source-structure/unit test with no browser — this is the
 * one exception, added because Playwright turned out to actually work in
 * this environment (confirmed via `npx playwright install chromium`).
 *
 * Builds and starts a real production server itself (`next build` then
 * `next start` — never dev mode, which would skip the static/ISR rendering
 * this CSP was specifically shaped around), drives it with a real Chromium
 * instance, and fails on any console message containing "Content Security
 * Policy" or "Refused to" — the two phrases Chromium actually uses when CSP
 * blocks something. This is the check nothing else in this repo could
 * perform: prior CSP work this session could only confirm the header's text
 * was well-formed, never that a real browser didn't block anything.
 *
 * Navigation uses waitForLoadState('domcontentloaded'), never 'load' —
 * 'load' waits for every sub-resource including the CharmHealth iframe on
 * the booking page, a third-party page outside this repo's control that may
 * never cleanly fire its own load event in a sandboxed environment, which
 * stalled an earlier version of this test for several minutes. CSP
 * violations are logged by the time the DOM parses and framework scripts
 * attempt to run, so domcontentloaded doesn't miss anything this test cares
 * about.
 *
 * Each test has a 30s timeout; the whole file is expected to finish well
 * under 3 minutes (build ~30-40s, then five small page/interaction checks).
 * Run it with an outer timeout of your own too — a bug in this file
 * shouldn't be able to hang a CI job indefinitely.
 *
 *   npx tsx --test scripts/test-e2e-csp-smoke.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const FORBIDDEN = [/Content Security Policy/i, /Refused to/i];
const TEST_TIMEOUT = 30_000;
const CLIENT_DIR = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:');

let server;
let browser;
let page;
const violations = [];

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['next', 'start', '-p', String(PORT)], {
      cwd: CLIENT_DIR,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let settled = false;
    const onData = (chunk) => {
      if (!settled && /Ready in/i.test(chunk.toString())) {
        settled = true;
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (!settled) reject(new Error(`Server exited early (code ${code})`));
    });
    setTimeout(() => {
      if (!settled) reject(new Error('Server did not report Ready within 20s'));
    }, 20_000);
  });
}

function stopServer(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.killed || proc.exitCode !== null) return resolve();
    proc.on('exit', resolve);
    if (process.platform === 'win32' && proc.pid) {
      // proc was spawned with shell:true (needed for npx on Windows), so
      // proc.kill() only kills the cmd.exe wrapper — the real `next start`
      // process (and its own children) survive underneath it and keep the
      // port bound. taskkill /T kills the whole tree.
      spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { shell: true });
    } else {
      proc.kill();
    }
    setTimeout(resolve, 3_000).unref();
  });
}

before(async () => {
  // Always a fresh production build — never dev mode, which skips the
  // static/ISR rendering this CSP was specifically verified against.
  const build = spawnSync('npx', ['next', 'build'], { cwd: CLIENT_DIR, shell: true, stdio: 'inherit' });
  if (build.status !== 0) throw new Error(`next build failed (exit ${build.status})`);

  server = await startServer();
  browser = await chromium.launch();
  page = await browser.newPage();
  page.on('console', (msg) => {
    const text = msg.text();
    if (FORBIDDEN.some((pattern) => pattern.test(text))) violations.push({ url: page.url(), text });
  });
  page.on('pageerror', (err) => {
    const text = String(err);
    if (FORBIDDEN.some((pattern) => pattern.test(text))) violations.push({ url: page.url(), text });
  });
});

after(async () => {
  await browser?.close();
  await stopServer(server);
});

function assertNoNewViolations(countBefore, label) {
  const newOnes = violations.slice(countBefore);
  if (newOnes.length > 0) {
    assert.fail(
      `${label}: ${newOnes.length} CSP-violation-shaped console message(s):\n` +
        newOnes.map((v) => `  [${v.url}] ${v.text}`).join('\n')
    );
  }
}

test('1. homepage loads with no CSP violation', { timeout: TEST_TIMEOUT }, async () => {
  const before_ = violations.length;
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  assertNoNewViolations(before_, '/');
});

test('2. the nav menu opens cleanly', { timeout: TEST_TIMEOUT }, async () => {
  const before_ = violations.length;
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assertNoNewViolations(before_, 'nav menu');
});

test('3. the chat launcher opens cleanly', { timeout: TEST_TIMEOUT }, async () => {
  const before_ = violations.length;
  await page.getByRole('button', { name: /chat with us/i }).click();
  await page.waitForTimeout(300);
  assertNoNewViolations(before_, 'chat launcher');
});

test('4. booking page loads with no CSP violation (not waiting on the CharmHealth iframe)', { timeout: TEST_TIMEOUT }, async () => {
  const before_ = violations.length;
  await page.goto(`${BASE_URL}/book-telehealth-mental-health-appointment`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  assertNoNewViolations(before_, '/book-telehealth-mental-health-appointment');
});

test('5. /videos loads with no CSP violation', { timeout: TEST_TIMEOUT }, async () => {
  const before_ = violations.length;
  await page.goto(`${BASE_URL}/videos`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  assertNoNewViolations(before_, '/videos');
});

test('6. contact page (Google Maps embed) loads with no CSP violation', { timeout: TEST_TIMEOUT }, async () => {
  const before_ = violations.length;
  await page.goto(`${BASE_URL}/contact-telehealth-mental-health-provider`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  assertNoNewViolations(before_, '/contact-telehealth-mental-health-provider');
});
