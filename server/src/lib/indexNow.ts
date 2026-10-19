import { env, indexNowConfigured } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * IndexNow (indexnow.org) — a simple ping protocol search engines that
 * participate (currently Bing, and others that opt in) use to learn a
 * page changed without waiting for their next scheduled crawl. This is
 * unrelated to the AI answer-engine crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, etc.) that Part 1 of this change allow-lists in
 * robots.ts — those crawl on their own schedule and don't support
 * IndexNow today; this only speeds up the search engines that do.
 *
 * Setup (do this once, the operator's own step — not something this
 * code can do for you):
 *   1. Generate any string as the key, e.g. `openssl rand -hex 16`.
 *   2. Set INDEXNOW_API_KEY to that value in the SERVER Vercel project's
 *      env (this file is the only thing that reads it).
 *   3. Create a static file at the CLIENT project's `public/<key>.txt`
 *      containing just that key (no newline needed, but harmless if
 *      present) — this is IndexNow's own ownership-verification
 *      convention: it fetches https://www.lifewellfhp.com/<key>.txt and
 *      checks the body matches the key you sent.
 *   4. Redeploy the client project so that file is live, then this
 *      starts working automatically — no further code change needed.
 *
 * Until INDEXNOW_API_KEY is set, pingIndexNow() is a silent no-op (one
 * log line), matching this codebase's established degrade-gracefully
 * convention for every other optional integration (mailConfigured,
 * geminiConfigured, turnstileConfigured).
 */
const INDEXNOW_HOST = 'www.lifewellfhp.com';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Pings IndexNow with one or more absolute or root-relative URLs that
 * just changed. Never throws — a failed ping must never block or fail
 * the admin save that triggered it (same posture as refreshPublicSite()
 * in refreshSite.ts, which this is designed to be called alongside).
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  if (!indexNowConfigured) {
    logger.info('indexnow skip', { reason: 'not configured' });
    return;
  }
  if (urls.length === 0) return;

  const urlList = urls.map((url) =>
    url.startsWith('http') ? url : `https://${INDEXNOW_HOST}${url.startsWith('/') ? url : `/${url}`}`
  );

  try {
    await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: env.INDEXNOW_API_KEY,
        keyLocation: `https://${INDEXNOW_HOST}/${env.INDEXNOW_API_KEY}.txt`,
        urlList,
      }),
    });
  } catch (err) {
    logger.info('indexnow ping failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
  }
}
