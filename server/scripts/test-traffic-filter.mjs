/**
 * Unit tests for isExcludedRequest() (src/lib/trafficFilter.ts) — the
 * server-side layer that decides whether a /api/public/analytics or
 * /api/public/conversions request is non-patient traffic (known bots/
 * crawlers, automation tooling, or a disallowed Origin) and should be
 * skipped before the database insert.
 *
 * Pure function of a minimal fake Express Request (just the two headers
 * it reads) — no network, no Supabase, no Express app needed.
 *
 *   npx tsx --test scripts/test-traffic-filter.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isExcludedRequest } from '../src/lib/trafficFilter.ts';

function fakeRequest({ userAgent, origin }) {
  return {
    get(header) {
      const key = header.toLowerCase();
      if (key === 'user-agent') return userAgent;
      if (key === 'origin') return origin;
      return undefined;
    },
  };
}

const REAL_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

test('1. a normal browser User-Agent with the real production Origin is not excluded', () => {
  const result = isExcludedRequest(
    fakeRequest({ userAgent: REAL_BROWSER_UA, origin: 'https://www.lifewellfhp.com' })
  );
  assert.equal(result.excluded, false);
});

test('2. a normal browser User-Agent with no Origin header is not excluded', () => {
  const result = isExcludedRequest(fakeRequest({ userAgent: REAL_BROWSER_UA, origin: undefined }));
  assert.equal(result.excluded, false);
});

test('3. known crawler User-Agents are excluded (isbot-covered)', () => {
  const uas = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  ];
  for (const userAgent of uas) {
    const result = isExcludedRequest(fakeRequest({ userAgent }));
    assert.equal(result.excluded, true, `expected ${userAgent} to be excluded`);
    assert.equal(result.reason, 'bot_user_agent');
  }
});

test('4. automation-tool User-Agents are excluded (the supplementary regex isbot may not flag)', () => {
  const uas = [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Lighthouse',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Playwright',
    'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Puppeteer',
    'selenium-webdriver/4.0',
  ];
  for (const userAgent of uas) {
    const result = isExcludedRequest(fakeRequest({ userAgent }));
    assert.equal(result.excluded, true, `expected ${userAgent} to be excluded`);
    assert.equal(result.reason, 'bot_user_agent');
  }
});

test('5. a disallowed Origin is excluded even with a normal browser User-Agent (a Vercel preview URL, or any other non-production origin)', () => {
  const uas = [
    'https://lifewellfhp-client-5pl0x1kut.vercel.app',
    'https://lifewellfhp-admin.vercel.app',
    'http://localhost:3000',
  ];
  for (const origin of uas) {
    const result = isExcludedRequest(fakeRequest({ userAgent: REAL_BROWSER_UA, origin }));
    assert.equal(result.excluded, true, `expected origin ${origin} to be excluded`);
    assert.equal(result.reason, 'disallowed_origin');
  }
});

test('6. both of the real production Origins (apex and www) are allowed', () => {
  for (const origin of ['https://www.lifewellfhp.com', 'https://lifewellfhp.com']) {
    const result = isExcludedRequest(fakeRequest({ userAgent: REAL_BROWSER_UA, origin }));
    assert.equal(result.excluded, false, `expected origin ${origin} to be allowed`);
  }
});

test('7. a bot User-Agent is excluded for that reason even when the Origin would otherwise be allowed (UA check runs first)', () => {
  const result = isExcludedRequest(
    fakeRequest({ userAgent: 'Googlebot/2.1', origin: 'https://www.lifewellfhp.com' })
  );
  assert.equal(result.excluded, true);
  assert.equal(result.reason, 'bot_user_agent');
});

test('8. a missing/empty User-Agent is not itself treated as a bot signal', () => {
  const result = isExcludedRequest(fakeRequest({ userAgent: undefined, origin: 'https://www.lifewellfhp.com' }));
  assert.equal(result.excluded, false);
});
