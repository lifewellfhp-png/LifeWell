import type { MetadataRoute } from 'next';
import { site } from '@/data/site';

/**
 * AI answer-engine/search crawlers, explicitly allow-listed by name even
 * though the wildcard rule below already allows everything — explicit
 * rules make the intent readable rather than relying on an implicit
 * side effect of the wildcard, and protect against this list ever being
 * narrowed later without someone noticing these specific bots.
 *
 * Does NOT include the Admin app (lifewellfhp-admin.vercel.app) — that's
 * a fully separate domain/project with no page under this site, so
 * there's no /admin path on THIS robots.txt to disallow.
 */
const AI_CRAWLER_USER_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Googlebot',
  'Google-Extended',
  'Bingbot',
  'Applebot',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /unsubscribe is a one-time action link, not content worth
        // indexing or citing — the only real disallow this site needs.
        disallow: ['/unsubscribe'],
      },
      ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: ['/unsubscribe'],
      })),
    ],
    // sitemap-es.xml is added to this list once Part 3's Spanish sitemap
    // route exists (see the feature/ai-search-and-spanish branch's later
    // commits) — kept to one real sitemap here so this commit never links
    // a 404.
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
