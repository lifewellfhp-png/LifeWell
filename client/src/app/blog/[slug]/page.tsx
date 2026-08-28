import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Section } from '@/components/ui/Section';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { Breadcrumbs } from '@/components/sections/PageHero';
import { ArticleDisclaimer } from '@/components/sections/ArticleDisclaimer';
import { JsonLd } from '@/components/seo/JsonLd';
import { CmsCta } from '@/components/CmsCta';
import { pageMetadata } from '@/lib/seo';
import { articleGraph } from '@/lib/schema';
import { fetchPublicBlogPost } from '@/lib/cms';
import { getServiceSummary } from '@/data/service-catalog';
import { formatDate, isoDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = { params: Promise<{ slug: string }> };

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Prefers the post's own social image, then its cover image. */
function socialImage(post: Record<string, unknown>): string | null {
  return str(post.og_image_url) || str(post.cover_image_url);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPublicBlogPost(slug);
  if (!post) {
    return pageMetadata({
      title: 'Article',
      description: 'LifeWell article',
      path: `/blog/${slug}`,
      noIndex: true,
    });
  }

  const image = socialImage(post);

  return pageMetadata({
    title: String(post.seo_title || post.title || 'Article'),
    description: String(post.seo_description || post.excerpt || ''),
    path: `/blog/${slug}`,
    type: 'article',
    publishedTime: str(post.published_at),
    modifiedTime: str(post.updated_at),
    image: image ? { url: image, alt: String(post.title || 'Article') } : undefined,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPublicBlogPost(slug);
  if (!post) notFound();

  const title = String(post.title || 'Article');
  const body = typeof post.body === 'string' ? post.body : '';
  const excerpt = typeof post.excerpt === 'string' ? post.excerpt : '';
  const authorName = str(post.author_name);
  const publishedAt = str(post.published_at);
  const coverImage = str(post.cover_image_url);
  const category = str(post.category);
  const relatedServiceSlug = str(post.related_service_slug);
  const relatedService = relatedServiceSlug ? getServiceSummary(relatedServiceSlug) : undefined;

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Blog', href: '/blog' },
    { name: title, href: `/blog/${slug}` },
  ];

  return (
    <>
      <JsonLd
        data={articleGraph({
          type: 'BlogPosting',
          path: `/blog/${slug}`,
          title,
          description: excerpt || title,
          image: socialImage(post) ? { url: socialImage(post) as string } : null,
          publishedAt,
          modifiedAt: str(post.updated_at),
          authorName,
          breadcrumb: crumbs,
        })}
        id={`blog-post-${slug}-schema`}
      />

      <InnerPageHero title={title} lead={excerpt || undefined} leadSize="subhead" />
      <Section tone="base">
        <Container>
          <Breadcrumbs items={crumbs} />

          {category && (
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-brand-primary-solid">
              {category}
            </p>
          )}

          {(authorName || publishedAt) && (
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border-subtle py-5 text-sm text-text-secondary">
              {authorName && <span>By {authorName}</span>}
              {authorName && publishedAt && (
                <span aria-hidden="true" className="text-border-strong">
                  •
                </span>
              )}
              {publishedAt && <time dateTime={isoDate(publishedAt)}>{formatDate(publishedAt)}</time>}
            </div>
          )}

          {coverImage && (
            <div className="mt-8 overflow-hidden rounded-md border border-border-subtle bg-surface-muted">
              {coverImage.startsWith('http') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverImage} alt="" className="w-full object-cover" />
              ) : (
                <Image
                  src={coverImage}
                  alt=""
                  width={1920}
                  height={1080}
                  priority
                  sizes="(min-width: 1024px) 52rem, 92vw"
                  className="w-full object-cover"
                />
              )}
            </div>
          )}

          <article className="mx-auto mt-9 max-w-[70ch] whitespace-pre-wrap text-[16px] leading-[1.7] text-[#374151] sm:text-[18px]">
            {body || excerpt || 'This article is being prepared.'}
          </article>

          <div className="mx-auto max-w-[70ch]">
            <ArticleDisclaimer />

            {relatedService && (
              <p className="mt-6 text-[15px] leading-[1.5] text-[#374151]">
                Related service:{' '}
                <Link
                  href={relatedService.href}
                  className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline"
                >
                  {relatedService.title}
                </Link>
              </p>
            )}
          </div>
        </Container>
      </Section>
      <CmsCta />
    </>
  );
}
