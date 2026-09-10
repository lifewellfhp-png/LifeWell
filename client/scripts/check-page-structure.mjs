/**
 * Page structure, metadata, and JSON-LD audit. This is `npm run
 * check:structure` (Phase 23) — internal link health is checked
 * separately by check-internal-links.mjs (`npm run check:links`).
 *
 * Migrated from check-links.mjs, which read prerendered HTML out of
 * .next/server/app — structurally broken for this app, since most routes
 * are server-rendered dynamically and never produce a static HTML file
 * (confirmed failing 0/30 pages on a clean baseline, unrelated to build
 * health). This audits the same properties against RENDERED pages
 * instead (post-hydration DOM, via Playwright), which works regardless of
 * how a route is rendered:
 *
 *   - exactly one <h1> per page and no skipped heading levels
 *   - every <img> carries an alt attribute
 *   - title and meta description are present and unique across pages
 *   - a canonical link is present
 *   - JSON-LD parses and contains no double-encoded entities
 *
 * Does not check links — see check-internal-links.mjs for that (dead
 * links, placeholder "#" hrefs, and rel="noopener" already live there).
 *
 *   npm run build && npm start              (in one terminal)
 *   node scripts/check-page-structure.mjs   (in another)
 */
import { chromium } from 'playwright';

const BASE = process.env.SITE_BASE ?? 'http://localhost:3000';

/** Same public route surface check-internal-links.mjs crawls. */
const ROUTES = [
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
const note = (page, kind, detail) => problems.push({ page, kind, detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const browser = await chromium.launch();
const page = await browser.newPage();

console.log(`\nPage structure audit — ${ROUTES.length} routes\n`);

const titles = new Map();
const descriptions = new Map();
let pagesChecked = 0;

for (const route of ROUTES) {
  let res;
  try {
    res = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(150);
  } catch (err) {
    note(route, 'crawl-error', `failed to load: ${err.message.split('\n')[0]}`);
    continue;
  }
  if (!res || res.status() >= 400) {
    note(route, 'crawl-error', `HTTP ${res?.status() ?? 'no response'}`);
    continue;
  }
  pagesChecked++;

  const data = await page.evaluate(() => {
    const levels = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) =>
      Number(h.tagName[1])
    );
    const imgsMissingAlt = Array.from(document.querySelectorAll('img')).filter(
      (img) => !img.hasAttribute('alt')
    ).length;
    const jsonLd = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    ).map((s) => s.textContent ?? '');
    return {
      levels,
      imgsMissingAlt,
      title: document.title || null,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
      hasCanonical: !!document.querySelector('link[rel="canonical"]'),
      jsonLd,
    };
  });

  const h1s = data.levels.filter((l) => l === 1).length;
  if (h1s !== 1) note(route, 'h1-count', `found ${h1s}`);

  let previous = 0;
  for (const level of data.levels) {
    if (previous && level > previous + 1) {
      note(route, 'heading-skip', `h${previous} -> h${level}`);
      break;
    }
    previous = level;
  }

  if (data.imgsMissingAlt > 0) note(route, 'img-missing-alt', `${data.imgsMissingAlt} <img> without alt`);

  if (!data.title) note(route, 'missing-title', '');
  else if (titles.has(data.title)) note(route, 'duplicate-title', `same as ${titles.get(data.title)}`);
  else titles.set(data.title, route);

  if (!data.description) note(route, 'missing-description', '');
  else if (descriptions.has(data.description))
    note(route, 'duplicate-description', `same as ${descriptions.get(data.description)}`);
  else descriptions.set(data.description, route);

  if (!data.hasCanonical) note(route, 'missing-canonical', '');

  for (const raw of data.jsonLd) {
    const decoded = decodeEntities(raw);
    let parsed;
    try {
      parsed = JSON.parse(decoded);
    } catch (e) {
      note(route, 'jsonld-invalid', e.message.slice(0, 80));
      continue;
    }
    const text = JSON.stringify(parsed);
    if (text.includes('&amp;')) note(route, 'jsonld-double-encoded', 'contains &amp;');
    if (/"@type"\s*:\s*"Article"/.test(text) && route === '/') {
      note(route, 'jsonld-homepage-article', 'homepage typed as Article');
    }
  }

  console.log(`  ${route.padEnd(52)}ok`);
  await sleep(60);
}

await browser.close();

/**
 * Same principle as check-internal-links.mjs's zero-crawl guard: a run
 * that checked nothing must fail loudly, not report a vacuous "no issues
 * found" — every route failing to load means the server isn't reachable
 * at BASE, not that the site has perfect structure.
 */
if (pagesChecked === 0) {
  console.error(
    `\nAll ${ROUTES.length} route(s) failed to load from ${BASE} — nothing was checked.\n` +
      `Is the server running? Run \`npm run build && npm start\` in one terminal, ` +
      `then this script in another (or set SITE_BASE to point elsewhere).\n`
  );
  process.exit(1);
}

console.log('');
if (problems.length === 0) {
  console.log(`✓ ALL PASS — ${pagesChecked} page(s), ${titles.size} unique titles, ${descriptions.size} unique descriptions\n`);
  process.exit(0);
}

const grouped = problems.reduce((acc, p) => {
  (acc[p.kind] ??= []).push(`${p.page} — ${p.detail}`);
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
