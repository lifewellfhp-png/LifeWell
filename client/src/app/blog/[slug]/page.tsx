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

/**
 * Article bodies are a single plain-text field (CMS `blog_posts.body`), not
 * markdown or HTML — authored with blank-line-separated paragraphs and
 * short, punctuation-free lines used as section labels (see the existing
 * "What Happens During a Psychiatric Evaluation" post). Previously all of
 * this rendered as undifferentiated <p> text via whitespace-pre-wrap, so a
 * screen reader or search crawler saw one long paragraph with no heading
 * structure at all. This gives those already-heading-shaped lines a real
 * <h2>, and "- " lines a real <ul>, without requiring a markdown authoring
 * format or a new dependency — a block only becomes a heading if it's a
 * single short line with no sentence-ending punctuation, so normal prose
 * paragraphs (including one-line ones that end in a period) are unaffected.
 */
function renderBody(body: string) {
  const blocks = body.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every((l) => l.startsWith('- '))) {
      return (
        <ul key={i} className="my-4 list-disc space-y-1.5 pl-6">
          {lines.map((l, j) => (
            <li key={j}>{l.slice(2)}</li>
          ))}
        </ul>
      );
    }
    const soleLine = lines.length === 1 ? lines[0] : undefined;
    if (soleLine && soleLine.length <= 90 && !/[.!?:]$/.test(soleLine)) {
      return (
        <h2 key={i} className="mt-9 font-heading text-[22px] font-normal text-[var(--lw-primary)] first:mt-0 sm:text-[26px]">
          {soleLine}
        </h2>
      );
    }
    return (
      <p key={i} className="mt-4 first:mt-0">
        {lines.join(' ')}
      </p>
    );
  });
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

          <article className="mx-auto mt-9 max-w-[70ch] text-[16px] leading-[1.7] text-[#374151] sm:text-[18px]">
            {body ? renderBody(body) : excerpt || 'This article is being prepared.'}
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

            {/* Universal next-step links, not per-article CMS data — every
                article benefits from a path to new-patient info and pricing;
                booking itself is already covered by <CmsCta /> below. */}
            <p className="mt-3 text-[15px] leading-[1.5] text-[#374151]">
              <Link href="/new-patients" className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline">
                What to Expect as a New Patient
              </Link>
              <span className="mx-2 text-text-secondary">·</span>
              <Link href="/fees-insurance" className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline">
                Fees &amp; Insurance
              </Link>
            </p>
          </div>
        </Container>
      </Section>
      <CmsCta />
    </>
  );
}
