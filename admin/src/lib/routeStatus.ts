/**
 * Advisory mirror of the public site's route inventory, used only to warn
 * editors in the SEO screen when a `seo_meta.path` will never be read by
 * `cmsMetadata()` (client/src/lib/cms-seo.ts does an exact-string lookup —
 * no fuzzy matching). This is intentionally NOT shared code with the client
 * app (separate deploys, no shared package in this monorepo) and NOT
 * enforced server-side (the API only validates path shape). It is advisory
 * only: keep it in sync by hand when client/src/app routes or
 * client/next.config.ts redirects change.
 */

// Every static (non-dynamic) page route in client/src/app, as passed to
// cmsMetadata()'s `fallback.path`.
export const KNOWN_STATIC_ROUTES: string[] = [
  '/',
  '/accessibility-statement',
  '/bio',
  '/blog',
  '/book-telehealth-mental-health-appointment',
  '/contact-telehealth-mental-health-provider',
  '/faqs',
  '/fees-insurance',
  '/our-services',
  '/privacy-policy',
  '/sms-consent-communication-policy',
  '/telehealth-mental-health-testimonials',
  '/terms-conditions',
  '/videos',
];

// Mirrors client/next.config.ts's redirects(). A redirect source 301s
// before any page renders, so it can never consume a seo_meta row itself —
// the row must target the destination instead.
export const KNOWN_REDIRECTS: { source: string; destination: string }[] = [
  { source: '/about', destination: '/bio' },
  { source: '/contact', destination: '/contact-telehealth-mental-health-provider' },
  { source: '/book', destination: '/book-telehealth-mental-health-appointment' },
  { source: '/testimonials', destination: '/telehealth-mental-health-testimonials' },
  { source: '/reviews', destination: '/telehealth-mental-health-testimonials' },
  { source: '/faq', destination: '/faqs' },
  { source: '/services-overview', destination: '/our-services' },
  { source: '/shop', destination: '/' },
  { source: '/cart', destination: '/' },
  { source: '/checkout', destination: '/' },
  { source: '/my-account', destination: '/' },
  { source: '/category/uncategorized', destination: '/blog' },
  {
    source: '/understanding-anxiety-symptoms-and-when-to-seek-help',
    destination: '/blog/understanding-anxiety-symptoms-and-when-to-seek-help',
  },
  {
    source: '/adult-adhd-what-to-know-about-evaluation-and-treatment',
    destination: '/blog/adult-adhd-what-to-know-about-evaluation-and-treatment',
  },
  {
    source: '/what-happens-during-a-psychiatric-evaluation',
    destination: '/blog/what-happens-during-a-psychiatric-evaluation',
  },
];

// Route families where a specific slug can't be verified from this list
// alone (real, but the individual slug isn't checked against the live
// catalog/CMS). Deliberately excludes the legacy /[slug] blog-post route:
// that route sets `dynamicParams = false`, so it only serves a closed,
// specific set of known slugs rather than an open family — an unrecognized
// single-segment path there genuinely 404s and should surface as unmatched.
const DYNAMIC_PREFIXES: { pattern: RegExp; label: string }[] = [
  { pattern: /^\/services\/[^/]+$/, label: '/services/[slug]' },
  { pattern: /^\/telehealth\/[^/]+$/, label: '/telehealth/[state]' },
  { pattern: /^\/blog\/[^/]+$/, label: '/blog/[slug]' },
];

function normalizePath(path: string): string {
  if (!path) return '/';
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.replace(/\/$/, '') || '/';
}

export type RouteStatus =
  | { kind: 'active'; label: string }
  | { kind: 'redirect'; label: string; destination: string }
  | { kind: 'dynamic'; label: string }
  | { kind: 'unmatched'; label: string };

export function classifyRoute(path: string | undefined | null): RouteStatus {
  const normalized = normalizePath(String(path ?? ''));

  if (KNOWN_STATIC_ROUTES.includes(normalized)) {
    return { kind: 'active', label: 'Active route' };
  }

  const redirect = KNOWN_REDIRECTS.find((r) => r.source === normalized);
  if (redirect) {
    return {
      kind: 'redirect',
      label: `Redirect → ${redirect.destination}`,
      destination: redirect.destination,
    };
  }

  const dynamic = DYNAMIC_PREFIXES.find((d) => d.pattern.test(normalized));
  if (dynamic) {
    return { kind: 'dynamic', label: `Dynamic route (${dynamic.label}, slug not verified)` };
  }

  return { kind: 'unmatched', label: 'No matching public route' };
}
