import type { Metadata } from 'next';
import { site } from '@/data/site';

/**
 * Canonical metadata builder. Every route derives its metadata from here so
 * titles and descriptions stay unique — the source site shipped the FAQ page
 * with the Privacy Policy's title and description verbatim.
 */

export const DEFAULT_OG_IMAGE = {
  // Served by the dynamic app/opengraph-image.tsx route (Next.js file
  // convention). A static /images/og/default.png was referenced here
  // previously but the file was never committed, so it 404'd in production.
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'LifeWell Family Health & Psychiatry — telehealth mental health care',
};

export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  /** Absolute or root-relative image path. Falls back to the branded default. */
  image?: { url: string; width?: number; height?: number; alt?: string };
  type?: 'website' | 'article';
  publishedTime?: string | null;
  modifiedTime?: string | null;
  noIndex?: boolean;
}

const absolute = (path: string) =>
  path.startsWith('http') ? path : `${site.url}${path.startsWith('/') ? path : `/${path}`}`;

export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  publishedTime,
  modifiedTime,
  noIndex = false,
}: PageMetaInput): Metadata {
  const canonical = absolute(path === '/' ? '/' : path.replace(/\/$/, ''));
  const brandedTitle = withBrand(title);
  const ogImage = {
    url: absolute(image.url),
    ...(image.width ? { width: image.width } : {}),
    ...(image.height ? { height: image.height } : {}),
    alt: image.alt || brandedTitle,
  };

  return {
    // `absolute` opts this title out of the root layout's `title.template`.
    // Branding is applied exactly once, here, regardless of whether the
    // supplied title (static fallback or CMS override) already mentions the
    // practice name — see withBrand().
    title: { absolute: brandedTitle },
    description,
    alternates: { canonical },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-snippet': -1,
            'max-image-preview': 'large',
            'max-video-preview': -1,
          },
        },
    openGraph: {
      type,
      title: brandedTitle,
      description,
      url: canonical,
      siteName: site.name,
      locale: site.locale,
      images: [ogImage],
      ...(type === 'article' && publishedTime ? { publishedTime } : {}),
      ...(type === 'article' && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: brandedTitle,
      description,
      images: [ogImage.url],
    },
  };
}

const BRAND_MENTION = /LifeWell/i;

/**
 * Collapses any redundant brand mentions a title already contains.
 *
 * Titles are pipe-delimited throughout this codebase (both static fallbacks
 * and CMS-entered values). If more than one segment mentions the brand, only
 * the first such segment is kept — this is what actually produced titles
 * like "... | LifeWell | LifeWell Family Health & Psychiatry" in production:
 * a CMS-entered title already ending in "| LifeWell" combined with the root
 * layout's title.template (which applies to every route except the
 * homepage — see layout.tsx) appending the full name again.
 */
function collapseBrandMentions(title: string): string {
  const segments = title.split('|').map((segment) => segment.trim());
  if (segments.length < 2) return title;
  const firstBrandedIndex = segments.findIndex((segment) => BRAND_MENTION.test(segment));
  if (firstBrandedIndex === -1) return title;
  return segments.slice(0, firstBrandedIndex + 1).join(' | ');
}

/** Appends the practice name, unless the title already carries it. */
export function withBrand(title: string): string {
  const deduped = collapseBrandMentions(title);
  return BRAND_MENTION.test(deduped) ? deduped : `${deduped} | ${site.name}`;
}
