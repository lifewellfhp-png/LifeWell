/**
 * Runs check-internal-links.mjs read-only against production instead of a
 * local server. Safe to run anytime: the crawl only ever issues GET requests
 * and never submits forms, activates booking, or dials/emails/texts anything
 * (see check-internal-links.mjs) — and it already rate-limits every request.
 *
 *   npm run check:links:prod
 */
process.env.SITE_BASE = process.env.SITE_BASE ?? 'https://www.lifewellfhp.com';
process.env.API_BASE = process.env.API_BASE ?? 'https://lifewellfhp-server.vercel.app';

await import('./check-internal-links.mjs');
