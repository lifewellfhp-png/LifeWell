/**
 * Runs check-deeplinks.mjs read-only against production instead of a local
 * server. Safe to run anytime: the script only ever issues GET requests
 * (see check-deeplinks.mjs) and paces them when the target isn't localhost.
 *
 *   npm run check:deeplinks:prod
 *
 * There is no production equivalent for check-forms.mjs — that script
 * submits real contact/newsletter POST requests and must only ever run
 * against a local server (see the comment at the top of check-forms.mjs).
 */
process.env.SITE_BASE = process.env.SITE_BASE ?? 'https://www.lifewellfhp.com';
process.env.API_BASE = process.env.API_BASE ?? 'https://lifewellfhp-server.vercel.app';

await import('./check-deeplinks.mjs');
