import { site } from '@/data/site';
import { provider } from '@/data/provider';
import { DEFAULT_OG_IMAGE } from '@/lib/seo';
import { telehealthStates, type TelehealthState } from '@/data/telehealth-states';
import type { Faq, Service, ServiceSummary } from '@/types/content';

/**
 * JSON-LD builders.
 *
 * Written from scratch rather than ported from the WordPress output, which
 * shipped several defects: HTML entities double-encoded into the graph
 * ("LifeWell Family Health &amp; Psychiatry"), the homepage typed as an
 * Article authored by the site developer, and a primaryImageOfPage declaring
 * 200x200 for a file that is actually 150x150.
 *
 * Organization, Person and WebSite are defined in full exactly once, by
 * homeGraph() (injected on every page via the root layout). Every other
 * graph below references them by @id only — Google explicitly supports
 * resolving @id references across multiple JSON-LD <script> blocks on the
 * same page, so the graph stays fully connected without redeclaring the
 * same entities on every route.
 */

const ORG_ID = `${site.url}/#organization`;
const WEBSITE_ID = `${site.url}/#website`;
const PROVIDER_ID = `${site.url}/#provider`;

const abs = (path: string) =>
  path.startsWith('http') ? path : `${site.url}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Shape of `cms.provider` (see mapProvider() in cms-resolve.ts) — kept local
 * and structural rather than importing a type from cms-resolve.ts, since no
 * exported type exists there and this is the only field set schema.ts needs.
 * Every field is optional so a partially-filled CMS row still produces valid
 * output: providerNode() falls back to the static record field-by-field.
 */
type ResolvedProviderLike = {
  name?: string;
  credentials?: string;
  title?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  certifications?: string[];
} | null;

/**
 * Splits a two-token "First Last" name for givenName/familyName. Bounded
 * deliberately: any name that isn't exactly two space-separated tokens
 * (a middle name, suffix, hyphenation, etc.) falls back to the existing
 * static values rather than guessing — for this single-provider site the
 * static fallback is never wrong, so there's no reason to risk a bad split.
 */
function splitName(fullName: string | undefined): { givenName: string; familyName: string } {
  const parts = fullName?.trim().split(/\s+/) ?? [];
  const [first, last] = parts;
  if (parts.length === 2 && first && last) return { givenName: first, familyName: last };
  return { givenName: 'Lourdie', familyName: 'Chachoute' };
}

/**
 * Every state the provider is authorized to treat patients in via telehealth
 * (plus Florida's in-person option). Single source: data/telehealth-states.ts.
 */
const allStatesServed = telehealthStates.map((s) => ({ '@type': 'State' as const, name: s.name }));

/* --------------------------------------------------------- core nodes --- */

export function organizationNode() {
  return {
    '@type': ['MedicalBusiness', 'MedicalClinic'],
    '@id': ORG_ID,
    name: site.name,
    alternateName: site.shortName,
    description: site.description,
    url: site.url,
    telephone: site.contact.phone,
    faxNumber: site.contact.fax,
    email: site.contact.email,
    logo: {
      '@type': 'ImageObject',
      url: abs('/images/brand/logo-v2.avif'),
      width: 354,
      height: 63,
    },
    image: abs(DEFAULT_OG_IMAGE.url),
    priceRange: '$$',
    medicalSpecialty: ['Psychiatric', 'PrimaryCare'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.state,
      postalCode: site.address.zip,
      addressCountry: site.address.country,
    },
    areaServed: allStatesServed,
    availableService: { '@id': `${site.url}/our-services#services` },
    openingHoursSpecification: site.hoursSpec.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    sameAs: site.social.map((s) => s.href),
    employee: { '@id': PROVIDER_ID },
  };
}

/**
 * `hasCredential` in Schema.org semantically describes a credential the
 * Person actually holds. A certifications-list entry explicitly marked
 * "(in progress)" is a real, approved fact to state in prose (bio text,
 * the static fallback, /bio) — but it is not yet an earned credential, so
 * it must not be emitted here. Deliberately narrow: this only recognizes
 * the exact approved wording, never infers completion from a date or
 * attempts any broader natural-language interpretation.
 */
function isCompletedCredential(entry: string): boolean {
  return !/\(in progress\)/i.test(entry);
}

/**
 * Person/Physician node. Prefers CMS-resolved provider data field-by-field,
 * falling back to the static record (client/src/data/provider.ts) for any
 * field the caller doesn't supply or the CMS hasn't set — so this always
 * produces complete, valid output whether or not CMS data is available.
 *
 * `alumniOf` (specific university names) and `knowsAbout`/`medicalSpecialty`
 * stay static deliberately: the CMS `education`/`certifications` fields are
 * free-text lines like "Doctor of Nursing Practice (DNP) — University of
 * Central Florida (in progress)" — extracting a clean institution name from
 * that would mean parsing prose, which this is intentionally avoiding.
 * `certifications` itself needs no such parsing (both the CMS and static
 * versions are already discrete list items), so it's synced directly —
 * except that an explicitly in-progress entry is filtered out of
 * `hasCredential` (see isCompletedCredential()), since that field
 * specifically claims a credential is held, not merely pursued.
 */
export function providerNode(resolved?: ResolvedProviderLike) {
  const name = resolved?.name || provider.name;
  const credentials = resolved?.credentials || provider.credentials;
  const jobTitle = resolved?.title || provider.role;
  const bioParagraphs = resolved?.bio
    ? resolved.bio.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    : provider.bio;
  const description = bioParagraphs[0] || provider.bio[0];
  const photoSrc = resolved?.photoUrl || provider.image.src;
  const certifications = resolved?.certifications?.length ? resolved.certifications : provider.certifications;
  const { givenName, familyName } = splitName(resolved?.name);

  return {
    '@type': ['Person', 'Physician'],
    '@id': PROVIDER_ID,
    name: `${name}, ${credentials}`,
    givenName,
    familyName,
    jobTitle,
    description,
    url: `${site.url}/bio`,
    image: {
      '@type': 'ImageObject',
      url: abs(photoSrc),
      width: provider.image.width,
      height: provider.image.height,
    },
    medicalSpecialty: 'Psychiatric',
    knowsAbout: provider.expertise,
    worksFor: { '@id': ORG_ID },
    alumniOf: [
      { '@type': 'CollegeOrUniversity', name: 'University of Central Florida' },
      { '@type': 'CollegeOrUniversity', name: 'South University' },
      { '@type': 'CollegeOrUniversity', name: 'Walden University' },
    ],
    hasCredential: certifications.filter(isCompletedCredential).map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'Board Certification',
      name: c,
    })),
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: site.url,
    name: site.name,
    description: site.description,
    publisher: { '@id': ORG_ID },
    inLanguage: site.language,
  };
}

function webPageNode(path: string, name: string, description: string) {
  const url = abs(path === '/' ? '/' : path.replace(/\/$/, ''));
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
    inLanguage: site.language,
  };
}

export function breadcrumbNode(trail: { name: string; href: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: abs(t.href),
    })),
  };
}

/* ----------------------------------------------------------- per page --- */

/**
 * Homepage entities: MedicalBusiness + Person + WebSite + WebPage.
 *
 * Injected on EVERY page via the root layout (not just "/") so Organization,
 * Person and WebSite are declared in full exactly once, site-wide. Every
 * other graph function below links to these by @id instead of redeclaring
 * them.
 */
export function homeGraph() {
  return graph([
    organizationNode(),
    providerNode(),
    websiteNode(),
    webPageNode('/', site.name, site.description),
  ]);
}

export function pageGraph(
  path: string,
  name: string,
  description: string,
  trail?: { name: string; href: string }[]
) {
  return graph([
    webPageNode(path, name, description),
    ...(trail ? [breadcrumbNode(trail)] : []),
  ]);
}

export function providerPageGraph(description: string, resolved?: ResolvedProviderLike) {
  const name = resolved?.name || provider.name;
  const credentials = resolved?.credentials || provider.credentials;
  return graph([
    {
      ...webPageNode('/bio', `${name}, ${credentials}`, description),
      '@type': 'ProfilePage',
      mainEntity: { '@id': PROVIDER_ID },
    },
    breadcrumbNode([
      { name: 'Home', href: '/' },
      { name: 'Meet Your Provider', href: '/bio' },
    ]),
  ]);
}

export function serviceGraph(service: Service, description: string) {
  const url = abs(`/services/${service.slug}`);
  return graph([
    webPageNode(`/services/${service.slug}`, service.title, description),
    {
      '@type': 'MedicalWebPage',
      '@id': `${url}#medicalwebpage`,
      url,
      name: service.title,
      about: { '@id': `${url}#service` },
    },
    {
      '@type': 'Service',
      '@id': `${url}#service`,
      name: service.title,
      description,
      serviceType: service.title,
      url,
      provider: { '@id': ORG_ID },
      areaServed: allStatesServed,
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceUrl: abs('/book-telehealth-mental-health-appointment'),
        name: 'Telehealth appointment',
      },
    },
    breadcrumbNode([
      { name: 'Home', href: '/' },
      { name: 'Services', href: '/our-services' },
      { name: service.title, href: `/services/${service.slug}` },
    ]),
  ]);
}

export function serviceListGraph(summaries: ServiceSummary[], description: string) {
  return graph([
    webPageNode('/our-services', 'Comprehensive Online Mental Health Services', description),
    {
      '@type': 'ItemList',
      '@id': `${site.url}/our-services#services`,
      name: 'Telehealth services',
      numberOfItems: summaries.length,
      itemListElement: summaries.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Service',
          name: s.title,
          description: s.description,
          url: abs(s.href),
          provider: { '@id': ORG_ID },
        },
      })),
    },
    breadcrumbNode([
      { name: 'Home', href: '/' },
      { name: 'Services', href: '/our-services' },
    ]),
  ]);
}

/** FAQPage — only emitted where the questions are genuinely visible on-page. */
export function faqGraph(faqs: Faq[], description: string) {
  return graph([
    webPageNode('/faqs', 'Frequently Asked Questions', description),
    {
      '@type': 'FAQPage',
      '@id': `${site.url}/faqs#faq`,
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
    breadcrumbNode([
      { name: 'Home', href: '/' },
      { name: 'FAQs', href: '/faqs' },
    ]),
  ]);
}

/**
 * /telehealth/[state] page graph. Scoped to the one state the page is
 * actually about — distinct from the sitewide Organization-level
 * `areaServed` (which lists all authorized states) and from the general
 * services catalog. Never implies a physical office outside Florida.
 */
export function telehealthStateGraph(state: TelehealthState, description: string) {
  const url = abs(`/telehealth/${state.slug}`);
  return graph([
    webPageNode(`/telehealth/${state.slug}`, `Psychiatric Care for ${state.name} Residents`, description),
    {
      '@type': 'Service',
      '@id': `${url}#service`,
      name: `Telehealth Psychiatric Care — ${state.name}`,
      description,
      serviceType: 'Psychiatric care',
      url,
      provider: { '@id': ORG_ID },
      areaServed: { '@type': 'State', name: state.name },
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceUrl: abs('/book-telehealth-mental-health-appointment'),
        name: 'Telehealth appointment',
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: state.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
    breadcrumbNode([
      { name: 'Home', href: '/' },
      { name: state.name, href: `/telehealth/${state.slug}` },
    ]),
  ]);
}

export interface ArticleSchemaInput {
  /** Defaults to 'Article'. Use 'BlogPosting' for informal blog content. */
  type?: 'Article' | 'BlogPosting';
  /** Root-relative path where this article actually renders, e.g. '/blog/my-post' or '/my-post'. */
  path: string;
  title: string;
  description: string;
  /** Omit width/height when the real dimensions of an uploaded image aren't known. */
  image?: { url: string; width?: number; height?: number } | null;
  publishedAt?: string | null;
  modifiedAt?: string | null;
  /**
   * Real byline text from the CMS, if the post has one. When omitted, the
   * article is attributed to the practice's own provider (the sole
   * clinician who reviews and publishes site content) rather than left
   * unattributed — never a fabricated name.
   */
  authorName?: string | null;
  breadcrumb: { name: string; href: string }[];
}

/**
 * Article/BlogPosting schema for blog posts. Authored by the clinician —
 * the source site attributed health content to "Mohidul Islam" (the
 * developer) and "admin".
 *
 * `path` must match the route the article actually renders at. Article
 * schema was previously hardcoded to `/blog/${slug}` regardless of caller,
 * which was wrong for the static app/[slug] system (root-level URLs like
 * /managing-anxiety-in-everyday-life) — harmless only because every one of
 * those posts was still unpublished placeholder content.
 */
export function articleGraph(input: ArticleSchemaInput) {
  const url = abs(input.path);
  const author =
    input.authorName && input.authorName.trim()
      ? { '@type': 'Person', name: input.authorName.trim() }
      : { '@id': PROVIDER_ID };

  return graph([
    webPageNode(input.path, input.title, input.description),
    {
      '@type': input.type ?? 'Article',
      '@id': `${url}#article`,
      headline: input.title,
      description: input.description,
      ...(input.image
        ? {
            image: {
              '@type': 'ImageObject',
              url: abs(input.image.url),
              ...(input.image.width ? { width: input.image.width } : {}),
              ...(input.image.height ? { height: input.image.height } : {}),
            },
          }
        : {}),
      ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
      dateModified: input.modifiedAt ?? input.publishedAt ?? undefined,
      author,
      publisher: { '@id': ORG_ID },
      isPartOf: { '@id': `${url}#webpage` },
      mainEntityOfPage: { '@id': `${url}#webpage` },
      inLanguage: site.language,
    },
    breadcrumbNode(input.breadcrumb),
  ]);
}

/* ---------------------------------------------------------- rendering --- */

function graph(nodes: unknown[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/**
 * Serialises a graph for injection. `<` is escaped so a stray "</script>" in
 * any content string cannot break out of the script element.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
