import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Section } from '@/components/ui/Section';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { Breadcrumbs } from '@/components/sections/PageHero';
import { ArticleDisclaimer } from '@/components/sections/ArticleDisclaimer';
import { BlogPostCard } from '@/components/sections/BlogPostCard';
import { SwapButton } from '@/components/ui/SwapButton';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageMetadata } from '@/lib/seo';
import { articleGraph } from '@/lib/schema';
import { fetchPublicBlogPost } from '@/lib/cms';
import { getResolvedContent } from '@/lib/cms-resolve';
import { getServiceSummary } from '@/data/service-catalog';
import { site } from '@/data/site';
import { formatDate, isoDate, estimateReadingTime } from '@/lib/utils';
import { isOptimizableImageSrc } from '@/lib/site-asset';
import { BLOG_AUTHOR_BYLINE } from '@/lib/blog';

type Props = { params: Promise<{ slug: string }> };

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Minimal inline-link support inside an otherwise-plain-text CMS field:
 * `[label](url)` becomes a real link — an internal <Link> for a root-relative
 * path (starts with "/"), or an external <a target="_blank" rel="noopener">
 * for an http(s) URL. Without this, a source citation or a mention of
 * another article could only ever be plain text, never an actual clickable
 * link, since the body has no HTML/markdown rendering otherwise.
 */
function renderInline(text: string, keyPrefix: string) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((\/[^\s)]+|https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const label = m[1] ?? '';
    const href = m[2] ?? '';
    parts.push(
      href.startsWith('/') ? (
        <Link key={`${keyPrefix}-${i}`} href={href} className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline">
          {label}
        </Link>
      ) : (
        <a
          key={`${keyPrefix}-${i}`}
          href={href}
          target="_blank"
          rel="noopener"
          className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline"
        >
          {label}
        </a>
      )
    );
    last = re.lastIndex;
    i++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Article bodies are a single plain-text field (CMS `blog_posts.body`), not
 * markdown or HTML — authored with blank-line-separated paragraphs and
 * short, punctuation-free lines used as section labels (see the existing
 * "What Happens During a Psychiatric Evaluation" post). Previously all of
 * this rendered as undifferentiated <p> text via whitespace-pre-wrap, so a
 * screen reader or search crawler saw one long paragraph with no heading
 * structure at all. This gives those already-heading-shaped lines a real
 * <h2>, "- " lines a real <ul>, and a `[label](url)` substring anywhere in a
 * paragraph or list item a real link (see renderInline) — without requiring
 * a markdown *renderer* or a new dependency. A block only becomes a heading
 * if it's a single short line with no sentence-ending punctuation, so normal
 * prose paragraphs (including one-line ones that end in a period) are
 * unaffected.
 */
function renderBody(body: string) {
  const blocks = body.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every((l) => l.startsWith('- '))) {
      return (
        <ul key={i} className="my-4 list-disc space-y-1.5 pl-6">
          {lines.map((l, j) => (
            <li key={j}>{renderInline(l.slice(2), `${i}-${j}`)}</li>
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
        {renderInline(lines.join(' '), `${i}`)}
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
  const [post, cms] = await Promise.all([fetchPublicBlogPost(slug), getResolvedContent()]);
  if (!post) notFound();

  const title = String(post.title || 'Article');
  const body = typeof post.body === 'string' ? post.body : '';
  const excerpt = typeof post.excerpt === 'string' ? post.excerpt : '';
  const publishedAt = str(post.published_at);
  const coverImage = str(post.cover_image_url);
  const category = str(post.category);
  const readingTime = estimateReadingTime(body);
  const relatedServiceSlug = str(post.related_service_slug);
  // Real per-post byline when the CMS has one; BLOG_AUTHOR_BYLINE is the
  // fallback for posts that never set author_name, not the only value.
  const authorName = str(post.author_name) || BLOG_AUTHOR_BYLINE;
  const relatedService = relatedServiceSlug ? getServiceSummary(relatedServiceSlug) : undefined;

  // Related articles: same category first, then other recent posts, up to
  // 3, always excluding the current post.
  const otherPosts = cms.posts.filter((p) => p.slug !== slug);
  const sameCategory = category ? otherPosts.filter((p) => p.category === category) : [];
  const relatedPosts = [...sameCategory, ...otherPosts.filter((p) => !sameCategory.includes(p))].slice(0, 3);

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

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border-subtle py-5 text-sm text-text-secondary">
            <span>By {authorName}</span>
            {publishedAt && (
              <span aria-hidden="true" className="text-border-strong">
                •
              </span>
            )}
            {publishedAt && <time dateTime={isoDate(publishedAt)}>{formatDate(publishedAt)}</time>}
            <span aria-hidden="true" className="text-border-strong">
              •
            </span>
            <span>{readingTime} min read</span>
          </div>

          {coverImage && (
            <div className="mt-8 overflow-hidden rounded-md border border-border-subtle bg-surface-muted">
              {isOptimizableImageSrc(coverImage) ? (
                <Image
                  src={coverImage}
                  alt=""
                  width={1920}
                  height={1080}
                  priority
                  sizes="(min-width: 1024px) 52rem, 92vw"
                  className="w-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverImage} alt="" className="w-full object-cover" />
              )}
            </div>
          )}

          <article className="mx-auto mt-9 max-w-[700px] text-[17px] leading-[1.75] text-[#374151] sm:text-[19px]">
            {body ? renderBody(body) : excerpt || 'This article is being prepared.'}
          </article>

          <div className="mx-auto max-w-[700px]">
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
                article benefits from a path to new-patient info and pricing. */}
            <p className="mt-3 text-[15px] leading-[1.5] text-[#374151]">
              <Link href="/new-patients" className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline">
                What to Expect as a New Patient
              </Link>
              <span className="mx-2 text-text-secondary">·</span>
              <Link href="/fees-insurance" className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline">
                Fees &amp; Insurance
              </Link>
            </p>

            <div className="mt-10 rounded-[20px] border-t-4 border-[var(--lw-accent)] bg-[#EEF2FA] p-7 text-center sm:p-10">
              <h2 className="font-heading text-[22px] font-normal text-[var(--lw-primary)] sm:text-[26px]">
                Ready to take the next step?
              </h2>
              <p className="mx-auto mt-3 max-w-[48ch] text-[14px] leading-[1.5] text-[#374151] sm:text-[15px]">
                Book a secure telehealth or in-person appointment with LifeWell Family Health &amp; Psychiatry.
              </p>
              <div className="mt-6 flex justify-center">
                <SwapButton href={site.booking.page} tone="accent" trackAs="booking_click">
                  Book an Appointment
                </SwapButton>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {relatedPosts.length > 0 && (
        <Section tone="muted">
          <Container>
            <h2 className="text-center font-heading text-[26px] font-normal text-[var(--lw-primary)] sm:text-[32px]">
              Related Articles
            </h2>
            <ul className="mt-10 grid list-none gap-8 md:grid-cols-3">
              {relatedPosts.map((p) => (
                <li key={p.slug}>
                  <BlogPostCard
                    post={{
                      slug: p.slug,
                      title: p.title,
                      excerpt: p.excerpt ?? null,
                      category: p.category ?? null,
                      coverImageUrl: p.coverImageUrl ?? null,
                      publishedAt: p.publishedAt ?? null,
                      body: p.body ?? null,
                    }}
                  />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}
    </>
  );
}
