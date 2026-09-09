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
 *   npm run build && npm start
 *   node scripts/check-deeplinks.mjs
 */
const BASE = process.env.SITE_BASE ?? 'http://localhost:3000';

/** [path, expected status, must appear in the served HTML] */
const CASES = [
  ['/', 200, 'Compassionate mental health care you can trust'],
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

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};

console.log('\nDirect-load / refresh audit\n');
console.log('Every URL loaded cold, exactly as a browser refresh does:\n');

for (const [path, expectStatus, mustContain] of CASES) {
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
  console.log(`  PASS  ${path.padEnd(48)} ${res.status}  ${body.length.toLocaleString()} bytes`);
}

console.log('\nLegacy and alias URLs (must redirect, never dead-end):\n');

for (const [from, to] of REDIRECTS) {
  const res = await fetch(BASE + from, { redirect: 'manual' });
  const location = res.headers.get('location');
  const ok = [301, 307, 308].includes(res.status) && location?.replace(/^https?:\/\/[^/]+/, '') === to;

  if (ok) {
    console.log(`  PASS  ${from.padEnd(48)} ${res.status} → ${to}`);
  } else {
    fail(`${from} → ${res.status} ${location ?? '(no Location)'}, expected redirect to ${to}`);
  }
}

console.log(
  `\n${failures === 0 ? '✓ ALL PASS — every route survives a direct load' : `✗ ${failures} failure(s)`}\n`
);
process.exit(failures === 0 ? 0 : 1);
