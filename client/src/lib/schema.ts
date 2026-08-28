import { site } from '@/data/site';
import { provider } from '@/data/provider';
import type { Faq, Service, ServiceSummary, BlogPost } from '@/types/content';

/**
 * JSON-LD builders.
 *
 * Written from scratch rather than ported from the WordPress output, which
 * shipped several defects: HTML entities double-encoded into the graph
 * ("LifeWell Family Health &amp; Psychiatry"), the homepage typed as an
 * Article authored by the site developer, and a primaryImageOfPage declaring
 * 200x200 for a file that is actually 150x150.
 */

const ORG_ID = `${site.url}/#organization`;
const WEBSITE_ID = `${site.url}/#website`;
const PROVIDER_ID = `${site.url}/#provider`;

const abs = (path: string) =>
  path.startsWith('http') ? path : `${site.url}${path.startsWith('/') ? path : `/${path}`}`;

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
    image: abs('/images/og/default.png'),
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
    areaServed: {
      '@type': 'State',
      name: site.address.regionName,
    },
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

export function providerNode() {
  return {
    '@type': ['Person', 'Physician'],
    '@id': PROVIDER_ID,
    name: `${provider.name}, ${provider.credentials}`,
    givenName: 'Lourdie',
    familyName: 'Chachoute',
    jobTitle: provider.role,
    description: provider.bio[0],
    url: `${site.url}/bio`,
    image: {
      '@type': 'ImageObject',
      url: abs(provider.image.src),
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
    hasCredential: provider.certifications.map((c) => ({
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

/** Homepage: WebPage + MedicalBusiness + WebSite. Never Article. */
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
    organizationNode(),
    websiteNode(),
    webPageNode(path, name, description),
    ...(trail ? [breadcrumbNode(trail)] : []),
  ]);
}

export function providerPageGraph(description: string) {
  return graph([
    organizationNode(),
    providerNode(),
    websiteNode(),
    {
      ...webPageNode('/bio', `${provider.name}, ${provider.credentials}`, description),
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
    organizationNode(),
    websiteNode(),
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
      areaServed: { '@type': 'State', name: site.address.regionName },
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
    organizationNode(),
    websiteNode(),
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
    organizationNode(),
    websiteNode(),
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
 * Article schema for blog posts. Authored by the clinician — the source site
 * attributed health content to "Mohidul Islam" (the developer) and "admin".
 */
export function articleGraph(post: BlogPost) {
  const url = abs(`/blog/${post.slug}`);
  return graph([
    organizationNode(),
    providerNode(),
    websiteNode(),
    webPageNode(`/blog/${post.slug}`, post.title, post.excerpt),
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: post.title,
      description: post.excerpt,
      ...(post.image
        ? { image: { '@type': 'ImageObject', url: abs(post.image), width: 1920, height: 1080 } }
        : {}),
      datePublished: post.publishedAt,
      dateModified: post.modifiedAt ?? post.publishedAt,
      author: { '@id': PROVIDER_ID },
      publisher: { '@id': ORG_ID },
      isPartOf: { '@id': `${url}#webpage` },
      mainEntityOfPage: { '@id': `${url}#webpage` },
      inLanguage: site.language,
    },
    breadcrumbNode([
      { name: 'Home', href: '/' },
      { name: 'Blog', href: '/blog' },
      { name: post.title, href: `/blog/${post.slug}` },
    ]),
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
