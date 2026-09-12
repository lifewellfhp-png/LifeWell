/**
 * Deep-link / refresh audit.
 *
 * Proves that hitting any URL directly — the thing a browser does on refresh —
 * returns real prerendered HTML rather than a 404 or an empty shell.
 *
 * This is the failure mode single-page apps have on static hosts, where every
 * path must be rewritten to index.html. Next.js App Router prerenders each
 * route to its own document, so no catch-all rewrite is needed — and adding one
 * would shadow the real routes and break the 404 page.
 *
 * Local dev:        npm run build && npm start   (client/), then:
 *                    npm run check:deeplinks
 * Production (read-only, GET-only, safe to run anytime):
 *                    npm run check:deeplinks:prod
 */
import { SITE_BASE as BASE, API_BASE, preflight, tryFetchPublicContent } from './lib/site-config.mjs';

await preflight({ requireSite: true, requireApi: false });

/**
 * The homepage headline lives in the CMS ("home"/"hero" section, edited by
 * the site owner through the Admin panel) and legitimately changes over
 * time — hardcoding today's exact wording here would just recreate the
 * staleness this script once had (it asserted a headline from an earlier
 * CMS edit, then failed for months after a later, equally legitimate edit
 * replaced it). Fetching the live value and checking the page reflects it
 * verifies the real thing that matters — CMS content actually reaches the
 * page — without ever going stale from a future approved copy change.
 *
 * Resolves to null (checked structurally instead, see CASES below) when the
 * API can't be reached, e.g. a local run with no API server up.
 */
async function resolveHomeHeadlinePrimary() {
  const data = await tryFetchPublicContent(API_BASE);
  const section = data?.sections?.find((s) => s.page_key === 'home' && s.section_key === 'hero');
  const headline = section?.content?.headline;
  if (typeof headline !== 'string' || !headline.trim()) return null;
  // Mirrors Hero.tsx's own split: text after an em dash renders in a
  // separate <span>, so only the text before it is a contiguous substring
  // of the raw HTML.
  const dashIndex = headline.indexOf('—');
  return (dashIndex > -1 ? headline.slice(0, dashIndex) : headline).trim();
}

const homeHeadline = await resolveHomeHeadlinePrimary();
if (homeHeadline) {
  console.log(`Resolved live homepage headline from CMS: "${homeHeadline}"\n`);
} else {
  console.log('CMS unreachable — homepage headline checked structurally only (h1 present, non-empty).\n');
}

/**
 * [path, expected status, mustContain]
 *
 * `mustContain` is only kept as an exact string where the wording itself is
 * a stable, code-sourced identifier (a person's name, a route-derived page
 * title) — not free-standing marketing copy that a non-engineer can and
 * does edit. Every 200-status page additionally gets a structural check
 * (see STRUCTURAL below): a non-empty <h1>, so an accidentally emptied page
 * fails even where no specific string is asserted.
 */
const CASES = [
  ['/', 200, homeHeadline],
  ['/bio', 200, 'Lourdie Chachoute'],
  ['/our-services', 200, 'Comprehensive Online Mental Health Services'],
  ['/services/psychiatric-evaluations', 200, 'Psychiatric Evaluations'],
  ['/services/weight-management-telehealth', 200, 'Weight Management'],
  ['/services/lab-testing-coordination-telehealth', 200, 'Lab Testing'],
  // Not 'Transparent Mental Health Fees' — the heading splits "Transparent"
  // and "Mental Health Fees..." across two <span> elements (for two-tone
  // styling) with an HTML comment between them for JSX whitespace control,
  // so that exact phrase never appears as a contiguous raw-HTML substring
  // even though it reads correctly to a human/screen reader. Match a
  // substring that's fully inside one span instead.
  ['/fees-insurance', 200, 'Mental Health Fees and Insurance'],
  ['/faqs', 200, 'Frequently Asked Questions'],
  ['/contact-telehealth-mental-health-provider', 200, 'Contact Telehealth Mental Health Provider'],
  ['/book-telehealth-mental-health-appointment', 200, 'Book an Appointment'],
  ['/telehealth-mental-health-testimonials', 200, 'Testimonials'],
  ['/blog', 200, 'Mental Health'],
  ['/managing-anxiety-in-everyday-life', 200, 'Managing Anxiety'],
  ['/when-to-consider-therapy-for-your-teen', 200, 'Therapy for Your Teen'],
  ['/privacy-policy', 200, 'Privacy'],
  ['/terms-conditions', 200, 'Terms'],
  ['/accessibility-statement', 200, 'Accessibility'],
  ['/sms-consent-communication-policy', 200, 'SMS'],
  ['/sitemap.xml', 200, '<urlset'],
  ['/robots.txt', 200, 'Sitemap:'],

  // Unknown paths must 404 — not silently render a shell.
  ['/definitely-not-a-page', 404, 'couldn’t find that page'],
  ['/services/not-a-real-service', 404, 'couldn’t find that page'],
  ['/blog/not-a-real-post', 404, 'couldn’t find that page'],
];

/** Legacy WordPress URLs used trailing slashes; these must resolve, not break. */
const REDIRECTS = [
  ['/bio/', '/bio'],
  ['/services/psychiatric-evaluations/', '/services/psychiatric-evaluations'],
  ['/about', '/bio'],
  ['/contact', '/contact-telehealth-mental-health-provider'],
  ['/book', '/book-telehealth-mental-health-appointment'],
  ['/faq', '/faqs'],
  ['/shop', '/'],
  ['/category/uncategorized', '/blog'],
];

/**
 * Structural link checks: destination URL + link presence + accessible name,
 * on the specific route where that link matters (relevant route / correct
 * service or state context) — rather than a copy-dependent text match.
 */
const LINK_CASES = [
  { route: '/', href: '/book-telehealth-mental-health-appointment', name: /book/i, label: 'homepage booking CTA' },
  {
    route: '/telehealth/florida',
    href: '/book-telehealth-mental-health-appointment',
    name: /book/i,
    label: 'Florida telehealth page booking CTA',
  },
  {
    route: '/services/psychiatric-evaluations',
    href: '/book-telehealth-mental-health-appointment',
    name: /book/i,
    label: 'service page booking CTA',
  },
];

/** Pages that aren't HTML documents, or are intentionally content-light (404s). */
const SKIP_STRUCTURAL_HEADING = new Set([
  '/sitemap.xml',
  '/robots.txt',
  '/definitely-not-a-page',
  '/services/not-a-real-service',
  '/blog/not-a-real-post',
]);

function extractH1Text(html) {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1]
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds an <a href="target...">...</a> whose visible text matches `name`.
 * Matches the href by path prefix, not exact equality: the booking
 * destination legitimately carries a CMS-configurable "#charm-calendar"
 * fragment on some CTAs and not others (see global/booking_profiles),
 * and a local run with no CMS configured falls back to a different-but-
 * still-correct default than production. What matters structurally is
 * that the link goes to the right page, not the exact query/fragment.
 */
function findLink(html, href, name) {
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const hrefMatch = attrs.match(/href="([^"]*)"/);
    if (!hrefMatch || !hrefMatch[1].startsWith(href)) continue;
    const text = m[2]
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.test(text)) return { found: true, text };
  }
  return { found: false, text: null };
}

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};

// Read-only and gentle: this script never POSTs, and when pointed at a
// non-local host (production read-only runs) it paces requests instead of
// firing dozens at once.
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE);
const pace = () => (isLocal ? Promise.resolve() : new Promise((r) => setTimeout(r, 150)));

console.log('Direct-load / refresh audit\n');
console.log('Every URL loaded cold, exactly as a browser refresh does:\n');

for (const [path, expectStatus, mustContain] of CASES) {
  await pace();
  const res = await fetch(BASE + path, { redirect: 'manual' });
  const body = await res.text();

  if (res.status !== expectStatus) {
    fail(`${path} → ${res.status}, expected ${expectStatus}`);
    continue;
  }
  if (mustContain && !body.includes(mustContain)) {
    fail(`${path} → ${res.status} but body missing "${mustContain}"`);
    continue;
  }
  // A prerendered document, not an empty client-rendered shell.
  const isHtml = res.headers.get('content-type')?.includes('text/html');
  if (isHtml && body.length < 2000) {
    fail(`${path} → suspiciously small document (${body.length} bytes)`);
    continue;
  }
  if (isHtml && expectStatus === 200 && !SKIP_STRUCTURAL_HEADING.has(path)) {
    const h1 = extractH1Text(body);
    if (!h1) {
      fail(`${path} → 200 but no non-empty <h1> found (structural check)`);
      continue;
    }
  }
  console.log(`  PASS  ${path.padEnd(48)} ${res.status}  ${body.length.toLocaleString()} bytes`);
}

console.log('\nLegacy and alias URLs (must redirect, never dead-end):\n');

for (const [from, to] of REDIRECTS) {
  await pace();
  const res = await fetch(BASE + from, { redirect: 'manual' });
  const location = res.headers.get('location');
  const ok = [301, 307, 308].includes(res.status) && location?.replace(/^https?:\/\/[^/]+/, '') === to;

  if (ok) {
    console.log(`  PASS  ${from.padEnd(48)} ${res.status} → ${to}`);
  } else {
    fail(`${from} → ${res.status} ${location ?? '(no Location)'}, expected redirect to ${to}`);
  }
}

console.log('\nCritical links: destination + presence + accessible name, on the relevant route:\n');

for (const { route, href, name, label } of LINK_CASES) {
  await pace();
  const res = await fetch(BASE + route, { redirect: 'manual' });
  const body = await res.text();
  const { found, text } = findLink(body, href, name);
  if (found) {
    console.log(`  PASS  ${label.padEnd(48)} "${text}" → ${href}`);
  } else {
    fail(`${label} — no link to ${href} with accessible name matching ${name} found on ${route}`);
  }
}

console.log(
  `\n${failures === 0 ? '✓ ALL PASS — every route survives a direct load' : `✗ ${failures} failure(s)`}\n`
);
process.exit(failures === 0 ? 0 : 1);
