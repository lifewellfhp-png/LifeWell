import type { MetadataRoute } from 'next';
import { site } from '@/data/site';
import { serviceSlugs, services } from '@/data/services';
import { telehealthStateSlugs } from '@/data/telehealth-states';
import { generatedLegalPages } from '@/data/generated/legal';
import { publishedPosts, postHref } from '@/data/blog';
import { fetchPublicCms } from '@/lib/cms';

const abs = (path: string) => `${site.url}${path === '/' ? '' : path}`;

/**
 * Sitemap.
 *
 * Core routes are static. Blog articles are loaded from the CMS API so newly
 * published admin posts appear without a frontend redeploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const cms = await fetchPublicCms();
  const cmsPosts = (cms?.posts ?? []).filter(
    (row): row is { slug: string; published_at?: string | null } =>
      Boolean(row && typeof row === 'object' && typeof (row as { slug?: string }).slug === 'string')
  );

  const core: MetadataRoute.Sitemap = [
    { url: abs('/'), lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: abs('/our-services'), lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: abs('/bio'), lastModified: now, changeFrequency: 'yearly', priority: 0.8 },
    { url: abs('/fees-insurance'), lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    {
      url: abs('/book-telehealth-mental-health-appointment'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.9,
    },
    {
      url: abs('/contact-telehealth-mental-health-provider'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.8,
    },
    { url: abs('/faqs'), lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    {
      url: abs('/telehealth-mental-health-testimonials'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    { url: abs('/videos'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];

  const serviceEntries: MetadataRoute.Sitemap = serviceSlugs.map((slug) => {
    const service = services.find((s) => s.slug === slug);
    return {
      url: abs(`/services/${slug}`),
      lastModified: service?.modified ? new Date(service.modified) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    };
  });

  const telehealthStateEntries: MetadataRoute.Sitemap = telehealthStateSlugs.map((slug) => ({
    url: abs(`/telehealth/${slug}`),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const blogIndex: MetadataRoute.Sitemap =
    cmsPosts.length > 0
      ? [{ url: abs('/blog'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 }]
      : [];

  const postEntries: MetadataRoute.Sitemap = cmsPosts.map((post) => ({
    url: abs(`/blog/${post.slug}`),
    lastModified: post.published_at ? new Date(post.published_at) : now,
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }));

  const legalEntries: MetadataRoute.Sitemap = generatedLegalPages.map((page) => ({
    url: abs(`/${page.slug}`),
    lastModified: page.updatedAt ? new Date(page.updatedAt) : now,
    changeFrequency: 'yearly' as const,
    priority: 0.3,
  }));

  /** Static articles that have real content (needsClientContent: false only). */
  const staticArticleEntries: MetadataRoute.Sitemap = publishedPosts.map((post) => ({
    url: abs(postHref(post.slug)),
    lastModified: post.modifiedAt ? new Date(post.modifiedAt) : post.publishedAt ? new Date(post.publishedAt) : now,
    changeFrequency: 'yearly' as const,
    priority: 0.6,
  }));

  return [
    ...core,
    ...serviceEntries,
    ...telehealthStateEntries,
    ...blogIndex,
    ...postEntries,
    ...staticArticleEntries,
    ...legalEntries,
  ];
}
