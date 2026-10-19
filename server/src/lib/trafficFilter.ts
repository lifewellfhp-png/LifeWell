/**
 * Shared, read-only traffic classification for the public analytics/
 * conversion ingest endpoints — identifies non-patient traffic (known
 * bots/crawlers, headless/automation tooling, and requests from an origin
 * outside the real public site) so it can be excluded from analytics
 * going forward. This never blocks the request itself (the caller still
 * gets a normal 201) — it only decides whether handleAnalyticsIngest/
 * handleConversionIngest should skip the database insert.
 *
 * Known limitation: modern Chrome's `--headless=new` mode deliberately no
 * longer self-identifies as "HeadlessChrome" in its User-Agent string, so
 * User-Agent sniffing alone cannot catch every modern headless browser.
 * This is mitigated client-side instead — see client/src/lib/cms.ts's
 * trackPageView/trackConversion, which check navigator.webdriver (the
 * W3C-standard automation flag Playwright/Puppeteer/Selenium set) before
 * ever making the request. The two checks here are a server-side layer
 * for traffic that never runs that client-side JS at all (declared
 * crawlers/bots), not a complete substitute for it.
 */
import type { Request } from 'express';
import { isbot } from 'isbot';

/** Automation tools isbot's own bot list does not reliably flag — these
 * drive a real browser engine rather than announcing themselves as a
 * content crawler, so they fall outside isbot's intended scope. */
const AUTOMATION_UA_RE = /HeadlessChrome|Lighthouse|Playwright|Puppeteer|Selenium|PhantomJS/i;

/** The only origins real visitors to the public site can send. Anything
 * else with an Origin header present — a Vercel preview deployment, the
 * admin app's own origin, a stray local dev origin — is not patient
 * traffic. Requests with NO Origin header (same-origin navigation, or a
 * non-browser caller) are not judged by this check alone; the generic
 * CORS allowlist in app.ts already governs those separately. */
const ALLOWED_ORIGINS = new Set(['https://www.lifewellfhp.com', 'https://lifewellfhp.com']);

export type ExcludedTrafficCheck = { excluded: boolean; reason?: 'bot_user_agent' | 'disallowed_origin' };

export function isExcludedRequest(req: Request): ExcludedTrafficCheck {
  const userAgent = req.get('user-agent') ?? '';
  if (userAgent && (isbot(userAgent) || AUTOMATION_UA_RE.test(userAgent))) {
    return { excluded: true, reason: 'bot_user_agent' };
  }

  const origin = req.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return { excluded: true, reason: 'disallowed_origin' };
  }

  return { excluded: false };
}
