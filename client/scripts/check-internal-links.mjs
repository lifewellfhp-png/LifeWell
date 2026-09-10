/**
 * Internal-link and deep-link validation. This is `npm run check:links`
 * (Phase 23) — page structure/metadata/JSON-LD now live separately in
 * check-page-structure.mjs (`npm run check:structure`), see that file.
 *
 * Replaced check-links.mjs's approach (read .next/server/app/*.html —
 * structurally broken for this app, since most routes are ƒ Dynamic and
 * never produce prerendered HTML files; confirmed failing identically on a
 * clean baseline before this app had any of Phase 18-21's changes, and
 * removed in Phase 23) and check-deeplinks.mjs's hardcoded expected-copy
 * assertions (fragile — breaks on any copy change, unrelated to link
 * health) with a real crawl: discovers links from RENDERED pages
 * (including the mobile menu, which only exists in the DOM once opened,
 * and any client/CMS-rendered content), normalizes and deduplicates them,
 * then verifies every unique internal destination actually resolves —
 * without submitting forms, creating bookings, or sending analytics.
 *
 *   npm run build && npm start          (in one terminal)
 *   node scripts/check-internal-links.mjs   (in another)
 */
import { chromium } from 'playwright';

const BASE = process.env.SITE_BASE ?? 'http://localhost:3000';
const ORIGIN = new URL(BASE).origin;
const CANONICAL_HOST = process.env.CANONICAL_HOST ?? 'lifewellfhp.com';
const REQUEST_DELAY_MS = 60; // rate limit — avoid production load spikes

/** Full public route surface: every route the responsive suite covers. */
const SEED_ROUTES = [
  '/',
  '/our-services',
  '/services/psychiatric-evaluations',
  '/services/weight-management-telehealth',
  '/services/medication-management',
  '/bio',
  '/fees-insurance',
  '/new-patients',
  '/faqs',
  '/contact-telehealth-mental-health-provider',
  '/book-telehealth-mental-health-appointment',
  '/telehealth/florida',
  '/telehealth/massachusetts',
  '/telehealth/arizona',
  '/telehealth-mental-health-testimonials',
  '/preceptorship-program',
  '/orlando-psychiatric-care',
  '/blog',
  '/managing-anxiety-in-everyday-life',
  '/privacy-policy',
  '/terms-conditions',
  '/accessibility-statement',
  '/sms-consent-communication-policy',
  '/unsubscribe',
  '/videos',
];

const problems = [];
const note = (kind, detail) => problems.push({ kind, detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------------------------------- normalize --- */

/**
 * Canonical form for dedup: absolute, default ports stripped, path kept
 * exactly as-is (trailing slash is a real, separately-tested behavior, not
 * collapsed here), query string preserved, fragment stripped (tracked
 * separately per source occurrence since the same page can be linked with
 * different fragments).
 */
function normalize(href, baseUrl) {
  let url;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return null; // malformed
  }
  url.hash = '';
  return url.toString();
}

function classify(href, baseUrl) {
  const trimmed = href.trim();
  if (!trimmed || trimmed === '#') return { kind: 'empty-or-bare-hash' };
  if (trimmed.startsWith('tel:')) return { kind: 'tel', value: trimmed };
  if (trimmed.startsWith('mailto:')) return { kind: 'mailto', value: trimmed };
  if (trimmed.startsWith('sms:')) return { kind: 'sms', value: trimmed };
  if (trimmed.startsWith('javascript:')) return { kind: 'javascript' };
  let url;
  try {
    url = new URL(trimmed, baseUrl);
  } catch {
    return { kind: 'malformed', value: trimmed };
  }
  const sameOrigin = url.origin === ORIGIN;
  const hash = url.hash ? url.hash.slice(1) : null;
  return {
    kind: sameOrigin ? 'internal' : 'external',
    url,
    hash,
    normalized: normalize(trimmed, baseUrl),
  };
}

/* ------------------------------------------------------------- crawl --- */

const browser = await chromium.launch();
const page = await browser.newPage();

/** source route -> [{ text, href, classification }] */
const discovered = new Map();

async function extractLinks(route) {
  const links = [];
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(150);

  const grab = async (label) => {
    const found = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map((a) => ({
        text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 60),
        href: a.getAttribute('href') || '',
      }))
    );
    for (const f of found) links.push({ ...f, via: label });
  };

  await grab('page');

  // Mobile menu only exists in the DOM once opened (MobileMenu.tsx returns
  // null while closed) — its nav links, phone link, and CTA are otherwise
  // invisible to a static-HTML or closed-DOM crawl entirely.
  const trigger = page.getByRole('button', { name: 'Open menu' });
  if (await trigger.count()) {
    try {
      // Wait for the trigger to be visible, then settle 300ms before
      // clicking — Playwright's visible-state check fires at first paint,
      // which can race React hydration attaching the click handler (same
      // mechanism search-reliability-trials.mjs measured and fixed: the
      // click registers but nothing opens if it lands before hydration).
      // 300ms is below typical human reaction time and was confirmed
      // there to give 100% first-attempt reliability; this crawler was
      // still using a flat post-navigation delay with no such margin,
      // which is what produced its intermittent "could not open mobile
      // menu" warnings (a different route each run — a timing race, not a
      // route-specific defect).
      await trigger.first().waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(300);
      await trigger.first().click({ timeout: 5000 });
      await page.locator('#mobile-menu').waitFor({ state: 'visible', timeout: 5000 });
      await grab('mobile-menu');
      await page.keyboard.press('Escape');
      await page.locator('#mobile-menu').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    } catch {
      note('crawl-warning', `${route} — could not open mobile menu to extract its links`);
    }
  }

  return links;
}

console.log(`\nCrawling ${SEED_ROUTES.length} seed routes for links...\n`);

for (const route of SEED_ROUTES) {
  let links;
  try {
    links = await extractLinks(route);
  } catch (err) {
    note('crawl-error', `${route} — failed to load for crawling: ${err.message.split('\n')[0]}`);
    continue;
  }
  discovered.set(route, links);
  console.log(`  ${route.padEnd(52)}${links.length} link(s)`);
  await sleep(REQUEST_DELAY_MS);
}

/**
 * A run that crawls nothing must fail loudly, not report a vacuous "ALL
 * PASS" — the exact failure mode this script replaced check-links.mjs to
 * fix (0/30 static pages found, silently misreported as a build problem).
 * Every seed route failing to load means the server isn't reachable at
 * BASE, not that the site has zero links.
 */
if (discovered.size === 0) {
  console.error(
    `\nAll ${SEED_ROUTES.length} seed route(s) failed to load from ${BASE} — nothing was crawled.\n` +
      `Is the server running? Run \`npm run build && npm start\` in one terminal, ` +
      `then this script in another (or set SITE_BASE to point elsewhere).\n`
  );
  await browser.close();
  process.exit(1);
}

/* --------------------------------------------------------- classify --- */

/** normalized URL -> { destUrl, hash: Set<string|null>, sources: [{route, text, href}] } */
const internalDestinations = new Map();
const externalLinks = new Map(); // normalized -> { sources }
const specialSchemes = []; // tel/mailto/sms

for (const [route, links] of discovered) {
  for (const { text, href, via } of links) {
    const c = classify(href, BASE + route);
    if (c.kind === 'empty-or-bare-hash' || c.kind === 'javascript') continue;

    if (c.kind === 'tel' || c.kind === 'mailto' || c.kind === 'sms') {
      specialSchemes.push({ route, text, href, kind: c.kind, via });
      continue;
    }
    if (c.kind === 'malformed') {
      note('malformed-url', `${route} (${via}) — "${text}" href="${href}"`);
      continue;
    }
    if (c.kind === 'external') {
      // Every external destination is listed in the report's "external
      // destinations discovered" summary below (grouped by host) for human
      // review — not flagged as an error by itself, per "links
      // unintentionally leaving the canonical domain" being a judgment call,
      // not an automatic failure.
      const key = c.normalized;
      if (!externalLinks.has(key)) externalLinks.set(key, { url: c.url, sources: [] });
      externalLinks.get(key).sources.push({ route, text, via });
      continue;
    }
    // internal
    const key = c.normalized;
    if (!internalDestinations.has(key)) {
      internalDestinations.set(key, { url: c.url, hashes: new Set(), sources: [] });
    }
    const entry = internalDestinations.get(key);
    if (c.hash) entry.hashes.add(c.hash);
    entry.sources.push({ route, text, via, href });
  }
}

console.log(
  `\nDiscovered ${internalDestinations.size} unique internal destination(s), ` +
    `${externalLinks.size} unique external destination(s), ` +
    `${specialSchemes.length} tel/mailto/sms link(s).\n`
);

/* -------------------------------------------------- special schemes --- */

console.log('Structural validation of tel:/mailto:/sms: links (not activated)\n');
// Minimum 3 digits, not 7 — legitimate short codes exist (988 Suicide &
// Crisis Lifeline, 911, 211, etc.) and must not be misclassified as
// malformed; see the explicit instruction not to treat crisis resources as
// failures.
const TEL_RE = /^tel:\+?[\d().\-\s]{3,}$/;
const MAILTO_RE = /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+(\?.*)?$/;
const SMS_RE = /^sms:\+?[\d().\-\s]{3,}(\?.*)?$/;
let specialOk = 0;
for (const s of specialSchemes) {
  const re = s.kind === 'tel' ? TEL_RE : s.kind === 'mailto' ? MAILTO_RE : SMS_RE;
  if (re.test(s.href)) {
    specialOk++;
  } else {
    note('malformed-special-scheme', `${s.route} (${s.via}) — "${s.text}" href="${s.href}"`);
  }
}
console.log(`  ${specialOk}/${specialSchemes.length} well-formed\n`);

/* -------------------------------------------------- internal fetches --- */

console.log('Testing every unique internal destination (max 5 redirect hops, rate-limited)...\n');

/** Fetch with manual redirect following so we can detect loops. */
async function resolveChain(startUrl) {
  const chain = [];
  let current = startUrl;
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current, { redirect: 'manual' });
    chain.push({ url: current, status: res.status });
    if ([301, 302, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) return { chain, error: 'redirect status with no Location header' };
      const next = new URL(loc, current).toString();
      if (chain.some((c) => c.url === next)) {
        return { chain, error: 'redirect loop' };
      }
      current = next;
      continue;
    }
    return { chain, finalStatus: res.status, finalUrl: current };
  }
  return { chain, error: 'too many redirects (>5 hops)' };
}

let tested = 0;
for (const [key, entry] of internalDestinations) {
  tested++;
  const result = await resolveChain(key);
  await sleep(REQUEST_DELAY_MS);

  const sourceSummary = entry.sources
    .slice(0, 3)
    .map((s) => `${s.route}${s.via === 'mobile-menu' ? ' (mobile menu)' : ''} "${s.text}"`)
    .join('; ');

  if (result.error) {
    note(
      'broken-link',
      `${key} — ${result.error} — chain: ${result.chain.map((c) => `${c.status}:${c.url}`).join(' -> ')} — linked from: ${sourceSummary}`
    );
    continue;
  }
  if (result.finalStatus >= 400) {
    note(
      'broken-link',
      `${key} — final status ${result.finalStatus}${result.chain.length > 1 ? ` (via ${result.chain.length - 1} redirect(s))` : ''} — linked from: ${sourceSummary}`
    );
    continue;
  }

  // Hash-fragment targets: verify an element with that id actually exists
  // on the rendered destination page.
  if (entry.hashes.size > 0) {
    try {
      const destPath = new URL(result.finalUrl).pathname + new URL(result.finalUrl).search;
      await page.goto(result.finalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(150);
      for (const id of entry.hashes) {
        const exists = await page.evaluate((id) => !!document.getElementById(id), id);
        if (!exists) {
          note('missing-hash-target', `${destPath}#${id} — no element with id="${id}" — linked from: ${sourceSummary}`);
        }
      }
      await sleep(REQUEST_DELAY_MS);
    } catch (err) {
      note('crawl-error', `${key} — failed to verify hash target(s): ${err.message.split('\n')[0]}`);
    }
  }
}
console.log(`  ${tested} internal destination(s) tested\n`);

/* ------------------------------------------------------ sitemap check --- */

console.log('Cross-checking sitemap.xml against crawled + seed routes...\n');
let sitemapUrls = [];
try {
  const res = await fetch(BASE + '/sitemap.xml');
  const xml = await res.text();
  sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
} catch (err) {
  note('crawl-error', `sitemap.xml — failed to fetch: ${err.message.split('\n')[0]}`);
}

const allKnownInternalPaths = new Set([
  ...SEED_ROUTES,
  ...[...internalDestinations.keys()].map((u) => new URL(u).pathname),
]);

let sitemapBroken = 0;
for (const loc of sitemapUrls) {
  let url;
  try {
    url = new URL(loc);
  } catch {
    note('sitemap-malformed', loc);
    continue;
  }
  if (url.origin !== ORIGIN && !url.hostname.endsWith(CANONICAL_HOST)) {
    note('sitemap-off-domain', loc);
    continue;
  }
  const res = await fetch(BASE + url.pathname + url.search, { redirect: 'manual' });
  await sleep(REQUEST_DELAY_MS);
  if (res.status >= 400) {
    sitemapBroken++;
    note('sitemap-entry-broken', `${loc} — ${res.status}`);
  }
}

// Blog posts flagged needsClientContent: true in the generated content data
// (src/data/generated/posts.ts) render (a real page, not a 404 — this is a
// content-review gate, not a routing gap) but are deliberately excluded from
// publishedPosts / the sitemap pending content-team review. Confirmed against
// both the generated data and production's live sitemap.xml (Phase 21).
const PENDING_CONTENT_SLUGS = new Set([
  'how-online-therapy-can-support-your-mental-health',
  'managing-anxiety-in-everyday-life',
  'when-to-consider-therapy-for-your-teen',
  'the-benefits-of-online-therapy-for-mental-wellbeing',
  'individual-therapy-a-safe-space-for-personal-growth',
  'how-online-couples-therapy-strengthens-relationships',
  'family-therapy-online-healing-together',
  'online-therapy-for-teens-support-during-critical-years',
  'managing-anxiety-with-online-therapy',
]);
const missingFromSitemap = [...allKnownInternalPaths].filter((p) => {
  const inSitemap = sitemapUrls.some((loc) => {
    try {
      return new URL(loc).pathname === p;
    } catch {
      return false;
    }
  });
  if (inSitemap) return false;
  // Utility/auxiliary routes that are deliberately not indexed.
  if (['/does-not-exist', '/unsubscribe'].includes(p)) return false;
  if (PENDING_CONTENT_SLUGS.has(p.replace(/^\//, ''))) return false;
  return true;
});
for (const p of missingFromSitemap) {
  note('route-omitted-from-sitemap', p);
}

console.log(
  `  ${sitemapUrls.length} sitemap entries, ${sitemapBroken} broken, ${missingFromSitemap.length} known route(s) not listed\n`
);

/* ---------------------------------------------------- external report --- */

console.log(`External destinations discovered (structural review only, never fetched):\n`);
const externalHosts = new Map();
for (const [, entry] of externalLinks) {
  const host = entry.url.hostname;
  externalHosts.set(host, (externalHosts.get(host) ?? 0) + entry.sources.length);
}
for (const [host, count] of [...externalHosts.entries()].sort()) {
  console.log(`  ${host.padEnd(40)}${count} link(s)`);
}
console.log('');

/* -------------------------------------------------------------- report --- */

await browser.close();

console.log('');
if (problems.length === 0) {
  console.log('✓ ALL PASS — every internal destination resolves, no broken links or sitemap gaps\n');
  process.exit(0);
}

const grouped = problems.reduce((acc, p) => {
  (acc[p.kind] ??= []).push(p.detail);
  return acc;
}, {});
for (const [kind, list] of Object.entries(grouped)) {
  console.log(`${kind} (${list.length})`);
  list.slice(0, 20).forEach((d) => console.log(`   ${d}`));
  if (list.length > 20) console.log(`   … and ${list.length - 20} more`);
  console.log('');
}
console.log(`${problems.length} issue(s)\n`);
process.exit(1);
