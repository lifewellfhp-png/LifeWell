import { corsOrigins } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { pingIndexNow } from './indexNow.js';

function siteOrigins() {
  const extra = (process.env.CLIENT_REVALIDATE_URLS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const defaults = corsOrigins.filter((origin) =>
    /lifewellfhp-client\.vercel\.app|www\.lifewellfhp\.com|localhost:3000/i.test(origin)
  );
  return Array.from(new Set([...defaults, ...extra]));
}

/** Tell the marketing site to drop cached pages after an admin save. */
export async function refreshPublicSite(): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET || '';
  const origins = siteOrigins();
  await Promise.all([
    ...origins.map(async (origin) => {
      try {
        await fetch(`${origin.replace(/\/$/, '')}/api/revalidate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(secret ? { 'x-revalidate-secret': secret } : {}),
          },
        });
      } catch (err) {
        logger.info('site refresh skip', {
          origin,
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }),
    // This generic save path (shared across every admin content type via
    // crudFactory.ts) doesn't know which specific public URL a given row
    // maps to, so this pings the site root — enough to prompt a re-crawl
    // without a per-content-type URL-mapping project. A caller that DOES
    // know the exact path (none currently do) could ping that instead.
    pingIndexNow(['/']),
  ]);
}
