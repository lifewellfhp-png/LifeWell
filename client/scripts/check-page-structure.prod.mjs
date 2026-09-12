/**
 * Runs check-page-structure.mjs read-only against production instead of a
 * local server. Safe to run anytime: this script only ever GETs pages and
 * inspects the rendered DOM — it never submits forms or activates booking,
 * email, telephone, SMS, or crisis links.
 *
 *   npm run check:structure:prod
 */
process.env.SITE_BASE = process.env.SITE_BASE ?? 'https://www.lifewellfhp.com';
process.env.API_BASE = process.env.API_BASE ?? 'https://lifewellfhp-server.vercel.app';

await import('./check-page-structure.mjs');
