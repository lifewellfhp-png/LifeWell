/**
 * Generates typed content modules from the WordPress source snapshots in
 * ../_source (pulled from the live WP REST API).
 *
 *   node scripts/generate-content.mjs
 *
 * Output: src/data/generated/services.ts, posts.ts
 *
 * This exists so the content layer is reproducible rather than hand-copied,
 * and so re-running against a fresh export is a one-command operation.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', '_source');
// Overridable so check-content-drift.mjs can regenerate into a scratch
// directory and diff against the committed output without ever touching it.
const OUT = process.env.GENERATED_OUT_DIR ?? join(here, '..', 'src', 'data', 'generated');
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ utils */

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&amp;/g, '&');

const text = (s) =>
  decode(s.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    // Source markup renders "<strong>Personal Information:</strong>Name, …",
    // which strips to "Personal Information:Name". Restore the missing space
    // only where a colon is immediately followed by a capital letter.
    .replace(/([a-z]):([A-Z])/g, '$1: $2')
    .trim();

const stripChrome = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

/** Walk rendered WP HTML and emit ordered content nodes. */
function parse(html) {
  const src = stripChrome(html);
  const nodes = [];
  const re =
    /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<p\b[^>]*>([\s\S]*?)<\/p>|<(ul|ol)\b[^>]*>([\s\S]*?)<\/\4>/gi;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) {
      const t = text(m[2]);
      if (t) nodes.push({ kind: 'heading', level: Number(m[1][1]), text: t });
    } else if (m[3] !== undefined) {
      const t = text(m[3]);
      if (t) nodes.push({ kind: 'paragraph', text: t });
    } else if (m[4]) {
      const items = [...m[5].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((li) => text(li[1]))
        .filter(Boolean);
      if (items.length) nodes.push({ kind: 'list', items });
    }
  }
  // Elementor renders duplicate desktop/mobile copies — collapse identical nodes.
  const seen = new Set();
  return nodes.filter((n) => {
    const k = JSON.stringify(n);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* Content that belongs to shared global components, not to page bodies. */
const GLOBAL_BLOCK_TEXT = [
  'Why Patients Choose',
  'Personalized One-on-One Care',
  'Private & Secure Telehealth Sessions',
  'Flexible & Convenient Scheduling',
  'Compassionate, Judgment-Free Support',
  'Evidence-Based Treatment Approach',
  'Sign up to Newsletter',
  'Stay Updated on Mental Health',
];

const isGlobalChrome = (t) => GLOBAL_BLOCK_TEXT.some((g) => t.startsWith(g));

/** Numeric-only or single-character nodes are Elementor step counters. */
const isNoise = (t) => /^[\d\s+%/.-]{0,4}$/.test(t) || t.length < 2;

/* ----------------------------------------------------------- services --- */

const servicesRaw = JSON.parse(readFileSync(join(SRC, 'services.json'), 'utf8'));

const SERVICE_CATEGORY = {
  'psychiatric-evaluations': 'psychiatric',
  'medication-management': 'psychiatric',
  'treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd': 'psychiatric',
  'psychiatric-follow-up-visits-telehealth': 'psychiatric',
  'annual-physical-exam-telehealth': 'primary-care',
  'chronic-disease-management-telehealth': 'primary-care',
  'preventive-care-telehealth': 'primary-care',
  'telehealth-sick-visits-primary-care': 'primary-care',
  'weight-management-telehealth': 'primary-care',
  'wellness-and-lifestyle-counseling-telehealth': 'primary-care',
  'lab-testing-coordination-telehealth': 'primary-care',
};

/** Display order mirrors the original site's menu grouping. */
const SERVICE_ORDER = Object.keys(SERVICE_CATEGORY);

function buildService(raw) {
  const nodes = parse(raw.content.rendered).filter(
    (n) => !(n.kind === 'heading' && (isGlobalChrome(n.text) || isNoise(n.text)))
  );

  // First heading is the page's own lead statement; everything before the
  // next heading is the introduction.
  let i = 0;
  let lead = '';
  if (nodes[0]?.kind === 'heading') {
    lead = nodes[0].text;
    i = 1;
  }

  const intro = [];
  while (i < nodes.length && nodes[i].kind !== 'heading') {
    if (nodes[i].kind === 'paragraph') intro.push(nodes[i].text);
    i++;
  }

  const sections = [];
  let current = null;
  for (; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.kind === 'heading') {
      if (current) sections.push(current);
      current = { heading: n.text, sourceLevel: n.level, blocks: [] };
    } else if (current) {
      current.blocks.push(
        n.kind === 'list' ? { type: 'list', items: n.items } : { type: 'text', text: n.text }
      );
    }
  }
  if (current) sections.push(current);

  // Every service page closes with a short call-to-action block: the final
  // section, one or two sentences, no list. Detected structurally rather than
  // by keyword so differently-worded CTAs aren't missed.
  let cta = null;
  const last = sections[sections.length - 1];
  if (
    last &&
    sections.length > 1 &&
    !last.blocks.some((b) => b.type === 'list') &&
    last.blocks.length <= 2
  ) {
    sections.pop();
    cta = {
      heading: last.heading,
      body: last.blocks.filter((b) => b.type === 'text').map((b) => b.text),
    };
  }

  return {
    slug: raw.slug,
    title: decode(raw.title.rendered),
    category: SERVICE_CATEGORY[raw.slug] ?? 'primary-care',
    lead,
    intro,
    sections,
    cta,
    wpId: raw.id,
    modified: raw.modified_gmt ? `${raw.modified_gmt}Z` : null,
  };
}

const services = SERVICE_ORDER.map((slug) => servicesRaw.find((s) => s.slug === slug))
  .filter(Boolean)
  .map(buildService);

if (services.length !== 11) {
  console.error(`Expected 11 services, built ${services.length}`);
  process.exit(1);
}

/* -------------------------------------------------------------- posts --- */

const postsRaw = JSON.parse(readFileSync(join(SRC, 'posts.json'), 'utf8'));
const seo = JSON.parse(readFileSync(join(SRC, 'seo-map.json'), 'utf8'));

/**
 * Demo/placeholder detection.
 *
 * The WordPress blog shipped with theme filler: the "Occidental / European
 * languages" lorem substitute, plus a dental-practice paragraph pasted into a
 * psychiatry article. Anything matching is flagged rather than published, so
 * no fabricated clinical text reaches the public site.
 */
const DEMO_SIGNALS = [
  // "Occidental / European languages" lorem substitute
  /Occidental/i,
  /European languages/i,
  /separate existence is a myth/i,
  /expensive translators/i,
  /skeptical Cambridge friend/i,
  /uniform grammar/i,
  // Classic lorem
  /Lorem ipsum/i,
  /This is item #\d+/i,
  /Click edit button to change this text/i,
  // Goethe "Sorrows of Young Werther" filler shipped with many WP themes
  /wonderful serenity has taken possession/i,
  /bliss of souls like mine/i,
  /exquisite sense of mere tranquil existence/i,
  /incapable of drawing a single stroke/i,
  // Dental-practice copy pasted into a psychiatry article
  /oral health myths/i,
  /keep your mouth healthy/i,
  // Commercial-moving-company copy pasted into a teen therapy article
  /spaces we relocate/i,
  /specialty equipment during transport/i,
  /warehouses, retail stores/i,
  /pre-move planning/i,
  // Physiotherapy demo copy pasted into an anxiety article
  /Learning proper posture/i,
  /orthopedic physiotherapy/i,
  /Receiving massage therapy/i,
  /Receiving manual therap/i,
  // Fictional people carried over from the theme demo
  /Anna Rue/i,
  /John Collins/i,
  /Cyber Engineer/i,
  // The theme vendor's own name, left in demo comment threads
  /cmsmasters/i,
];

function buildPost(raw) {
  const nodes = parse(raw.content.rendered).filter(
    (n) => !(n.kind === 'heading' && (isGlobalChrome(n.text) || isNoise(n.text)))
  );
  const body = nodes
    .map((n) => (n.kind === 'list' ? n.items.join(' ') : n.text))
    .join(' ');

  const matched = DEMO_SIGNALS.filter((r) => r.test(body)).map((r) => String(r));
  const url = `https://lifewellfhp.com/${raw.slug}/`;
  const meta = seo[url] ?? {};

  const blocks = [];
  for (const n of nodes) {
    if (n.kind === 'heading') blocks.push({ type: 'heading', text: n.text });
    else if (n.kind === 'list') blocks.push({ type: 'list', items: n.items });
    else blocks.push({ type: 'text', text: n.text });
  }

  return {
    slug: raw.slug,
    title: decode(raw.title.rendered),
    excerpt: meta.description ?? '',
    category: meta.section ?? null,
    tags: meta.tags ?? [],
    publishedAt: raw.date_gmt ? `${raw.date_gmt}Z` : null,
    modifiedAt: raw.modified_gmt ? `${raw.modified_gmt}Z` : null,
    image: meta.ogImage ? `/images/blog/${(meta.ogImage.match(/80-blog-(\d+)/) ?? [])[1] ?? '1'}.webp` : null,
    // `true` means the source body is theme filler and must not be published.
    needsClientContent: matched.length > 0,
    demoSignals: matched,
    blocks,
    wpId: raw.id,
  };
}

const posts = postsRaw
  .map(buildPost)
  .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));

/* -------------------------------------------------------------- legal --- */

const pagesRaw = JSON.parse(readFileSync(join(SRC, 'pages.json'), 'utf8'));

const LEGAL_SLUGS = [
  'privacy-policy',
  'terms-conditions',
  'accessibility-statement',
  'sms-consent-communication-policy',
];

function buildLegal(slug) {
  const raw = pagesRaw.find((p) => p.slug === slug);
  if (!raw) throw new Error(`Missing legal page: ${slug}`);

  const nodes = parse(raw.content.rendered).filter(
    (n) => !(n.kind === 'heading' && (isGlobalChrome(n.text) || isNoise(n.text)))
  );

  let i = 0;
  let heading = decode(raw.title.rendered);
  if (nodes[0]?.kind === 'heading') {
    heading = nodes[0].text;
    i = 1;
  }

  const intro = [];
  while (i < nodes.length && nodes[i].kind !== 'heading') {
    if (nodes[i].kind === 'paragraph') intro.push(nodes[i].text);
    i++;
  }

  const sections = [];
  let current = null;
  for (; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.kind === 'heading') {
      if (current) sections.push(current);
      current = { heading: n.text, blocks: [] };
    } else if (current) {
      current.blocks.push(
        n.kind === 'list' ? { type: 'list', items: n.items } : { type: 'text', text: n.text }
      );
    }
  }
  if (current) sections.push(current);

  const url = `https://lifewellfhp.com/${slug}/`;
  const meta = seo[url] ?? {};

  return {
    slug,
    title: decode(raw.title.rendered),
    heading,
    intro,
    sections,
    seoTitle: meta.title ?? null,
    seoDescription: meta.description ?? null,
    updatedAt: raw.modified_gmt ? `${raw.modified_gmt}Z` : null,
    wpId: raw.id,
  };
}

const legal = LEGAL_SLUGS.map(buildLegal);

/* -------------------------------------------------------------- write --- */

const banner = `// AUTO-GENERATED by scripts/generate-content.mjs — do not edit by hand.
// Source: WordPress REST API snapshot in /_source (pages, services, posts, media).
// Re-run:  node scripts/generate-content.mjs
`;

writeFileSync(
  join(OUT, 'services.ts'),
  `${banner}
import type { Service } from '@/types/content';

export const generatedServices: Service[] = ${JSON.stringify(services, null, 2)};
`
);

writeFileSync(
  join(OUT, 'posts.ts'),
  `${banner}
import type { BlogPost } from '@/types/content';

export const generatedPosts: BlogPost[] = ${JSON.stringify(posts, null, 2)};
`
);

writeFileSync(
  join(OUT, 'legal.ts'),
  `${banner}
import type { LegalPage } from '@/types/content';

export const generatedLegalPages: LegalPage[] = ${JSON.stringify(legal, null, 2)};
`
);

/* ------------------------------------------------------------- report --- */

console.log(`\nGenerated ${services.length} services:`);
for (const s of services) {
  const words = [...s.intro, ...s.sections.flatMap((x) => x.blocks.map((b) => (b.type === 'list' ? b.items.join(' ') : b.text)))]
    .join(' ')
    .split(/\s+/).length;
  console.log(
    `  ${s.category === 'psychiatric' ? 'PSY' : 'PRI'}  ${s.slug.padEnd(58)} ${String(s.sections.length).padStart(2)} sections  ~${words} words${s.cta ? '  +cta' : '  NO CTA'}`
  );
}

const flagged = posts.filter((p) => p.needsClientContent);
console.log(`\nGenerated ${posts.length} posts — ${flagged.length} flagged as demo/placeholder content:`);
for (const p of posts) {
  console.log(`  ${p.needsClientContent ? 'FLAGGED ' : 'OK      '} ${p.slug}`);
}
console.log('');
