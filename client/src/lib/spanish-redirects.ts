import { postSlugs } from '@/data/blog';
import { generatedLegalPages } from '@/data/generated/legal';
import { serviceSlugs } from '@/data/services';
import { telehealthStateSlugs } from '@/data/telehealth-states';

const corePaths = new Set([
  '/',
  '/our-services',
  '/bio',
  '/fees-insurance',
  '/new-patients',
  '/book-telehealth-mental-health-appointment',
  '/contact-telehealth-mental-health-provider',
  '/faqs',
  '/telehealth-mental-health-testimonials',
  '/videos',
  '/blog',
  '/accessibility-statement',
  '/privacy-policy',
  '/sms-consent-communication-policy',
  '/terms-conditions',
  '/unsubscribe',
]);

const englishPaths = new Set([
  ...corePaths,
  ...generatedLegalPages.map((page) => `/${page.slug}`),
  ...postSlugs.map((slug) => `/${slug}`),
  ...serviceSlugs.map((slug) => `/services/${slug}`),
  ...telehealthStateSlugs.map((slug) => `/telehealth/${slug}`),
]);

const englishAliases = new Map([
  ['/services', '/our-services'],
  ['/about', '/bio'],
  ['/contact', '/contact-telehealth-mental-health-provider'],
  ['/book', '/book-telehealth-mental-health-appointment'],
  ['/testimonials', '/telehealth-mental-health-testimonials'],
  ['/reviews', '/telehealth-mental-health-testimonials'],
  ['/faq', '/faqs'],
]);

export function englishPathForSpanishPath(pathname: string): string {
  if (pathname === '/es') return '/';
  if (!pathname.startsWith('/es/')) return pathname;

  const candidate = pathname.slice('/es'.length);
  const alias = englishAliases.get(candidate);
  if (alias) return alias;
  return englishPaths.has(candidate) ? candidate : '/';
}
