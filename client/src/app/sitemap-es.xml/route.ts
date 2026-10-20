import { NextResponse } from 'next/server';
import { site } from '@/data/site';
import { telehealthStateSlugs } from '@/data/telehealth-states';

export const dynamic = 'force-dynamic';

/**
 * Spanish sitemap — a separate file from the main sitemap.xml (Next's
 * sitemap.ts file convention only produces one /sitemap.xml; this is a
 * plain Route Handler returning hand-built XML instead, same approach
 * as llms.txt). Lists only the Spanish pages that actually exist (Part
 * 3) and are indexable — the 4 legal/policy key-notice pages are
 * deliberately noIndex (see their own generateMetadata) and so are
 * excluded here too, consistent with that choice.
 *
 * robots.ts links both this and the main sitemap.xml.
 */
const ES_PATHS = [
  '/es',
  '/es/our-services',
  '/es/fees-insurance',
  '/es/new-patients',
  '/es/contact-telehealth-mental-health-provider',
  '/es/book-telehealth-mental-health-appointment',
  '/es/faqs',
  ...telehealthStateSlugs.map((slug) => `/es/telehealth/${slug}`),
];

export async function GET() {
  const now = new Date().toISOString();
  const urls = ES_PATHS.map(
    (path) => `  <url>\n    <loc>${site.url}${path}</loc>\n    <lastmod>${now}</lastmod>\n  </url>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
