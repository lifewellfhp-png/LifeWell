import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { Container, Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs } from '@/components/sections/PageHero';
import { ArticleDisclaimer } from '@/components/sections/ArticleDisclaimer';
import { CmsCta } from '@/components/CmsCta';
import { JsonLd } from '@/components/seo/JsonLd';

import { getPost, postSlugs } from '@/data/blog';
import { serviceSummaries, getServiceSummary } from '@/data/service-catalog';
import { provider } from '@/data/provider';
import { formatDate, isoDate } from '@/lib/utils';
import { pageMetadata } from '@/lib/seo';
import { articleGraph } from '@/lib/schema';

/**
 * Blog article.
 *
 * Posts keep their original root-level WordPress URLs (for example
 * /managing-anxiety-in-everyday-life) so indexed links and bookmarks continue
 * to resolve. Static route segments take precedence over this dynamic one, and
 * `dynamicParams = false` limits it to the nine known slugs, so every other
 * path still 404s correctly.
 */
export function generateStaticParams() {
  return postSlugs.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  return pageMetadata({
    title: post.title,
    description: post.excerpt || `${post.title} — LifeWell Family Health & Psychiatry.`,
    path: `/${slug}`,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.modifiedAt,
    image: post.image
      ? { url: post.image, width: 1920, height: 1080, alt: post.title }
      : undefined,
    // Placeholder-bodied posts must not be indexed as thin content.
    noIndex: post.needsClientContent,
  });
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Blog', href: '/blog' },
    { name: post.title, href: `/${slug}` },
  ];

  return (
    <>
      {/* Article schema only where a real article exists. */}
      {!post.needsClientContent && (
        <JsonLd
          data={articleGraph({
            path: `/${slug}`,
            title: post.title,
            description: post.excerpt || post.title,
            image: post.image ? { url: post.image, width: 1920, height: 1080 } : null,
            publishedAt: post.publishedAt,
            modifiedAt: post.modifiedAt,
            breadcrumb: crumbs,
          })}
          id={`post-${slug}-schema`}
        />
      )}

      <Section tone="raised" spacing="sm" as="article">
        <Container size="prose">
          <Breadcrumbs items={crumbs} />

          <header className="mt-6">
            {post.category && (
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-brand-primary-solid">
                {post.category}
              </p>
            )}
            <h1>{post.title}</h1>
            {post.excerpt && (
              <p className="mt-6 text-lead text-text-secondary">{post.excerpt}</p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border-subtle py-5 text-sm text-text-secondary">
              <span>
                By{' '}
                <Link href="/bio" className="font-semibold text-text-link">
                  {provider.name}, {provider.credentials}
                </Link>
              </span>
              {post.publishedAt && (
                <>
                  <span aria-hidden="true" className="text-border-strong">
                    •
                  </span>
                  <time dateTime={isoDate(post.publishedAt)}>{formatDate(post.publishedAt)}</time>
                </>
              )}
            </div>
          </header>

          {post.image && (
            <div className="mt-9 overflow-hidden rounded-md border border-border-subtle bg-surface-muted">
              <Image
                src={post.image}
                alt=""
                width={1920}
                height={1080}
                priority
                sizes="(min-width: 1024px) 52rem, 92vw"
                className="w-full object-cover"
              />
            </div>
          )}

          <div className="mt-11">
            {post.needsClientContent ? (
              <PendingArticle title={post.title} />
            ) : (
              <div className="prose-clinical">
                {post.blocks.map((block, i) => {
                  if (block.type === 'heading') {
                    return (
                      <h2 key={i} className="text-h4">
                        {block.text}
                      </h2>
                    );
                  }
                  if (block.type === 'list') {
                    return (
                      <ul key={i} className="list-disc space-y-2 pl-6">
                        {block.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    );
                  }
                  return <p key={i}>{block.text}</p>;
                })}
              </div>
            )}
          </div>

          {!post.needsClientContent && (
            <>
              <ArticleDisclaimer />
              {post.relatedServiceSlug && getServiceSummary(post.relatedServiceSlug) && (
                <p className="mt-6 text-md text-text-secondary">
                  Related service:{' '}
                  <Link
                    href={getServiceSummary(post.relatedServiceSlug)!.href}
                    className="font-semibold text-text-link"
                  >
                    {getServiceSummary(post.relatedServiceSlug)!.title}
                  </Link>
                </p>
              )}
            </>
          )}

          {post.tags.length > 0 && (
            <ul className="mt-11 flex list-none flex-wrap gap-2 border-t border-border-subtle pt-8">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-pill border border-border-subtle bg-surface-muted px-4 py-1.5 text-xs text-text-secondary"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}

          <AuthorBox />
        </Container>
      </Section>

      <CmsCta />
    </>
  );
}

/**
 * Rendered in place of source content that is theme filler rather than clinical
 * writing. Written for patients — it carries no development notes.
 */
function PendingArticle({ title }: { title: string }) {
  const related = serviceSummaries.slice(0, 3);

  return (
    <div>
      <div className="rounded-md border border-border-subtle bg-surface-muted px-7 py-8">
        <h2 className="text-h5">This article is being written</h2>
        <p className="mt-3 text-md leading-relaxed text-text-secondary">
          We’re preparing a thorough, clinically reviewed piece on{' '}
          <span className="font-semibold text-text-primary">{title.toLowerCase()}</span>. Rather
          than publish something incomplete, we’d prefer to get it right.
        </p>
        <p className="mt-4 text-md leading-relaxed text-text-secondary">
          If this topic is relevant to you right now, please reach out — you can speak with a
          board-certified psychiatric nurse practitioner directly.
        </p>
        <div className="mt-7 flex flex-col gap-4 sm:flex-row">
          <Button href="/contact-telehealth-mental-health-provider">Ask a question</Button>
          <Button href="/our-services" variant="outline">
            Explore services
          </Button>
        </div>
      </div>

      <h2 className="mt-11 text-h5">Related services</h2>
      <ul className="mt-5 grid list-none gap-4 sm:grid-cols-3">
        {related.map((s) => (
          <li key={s.slug}>
            <Link
              href={s.href}
              className="flex h-full flex-col rounded-md border border-border-subtle bg-surface-raised p-5 no-underline transition-colors duration-fast hover:border-brand-primary/40"
            >
              <span className="font-heading text-md font-semibold text-text-primary">
                {s.title}
              </span>
              <span className="mt-2 text-sm text-text-secondary">Learn more →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AuthorBox() {
  return (
    <aside className="mt-12 flex flex-col gap-5 rounded-md border border-border-subtle bg-surface-muted p-7 sm:flex-row">
      <Image
        src={provider.image.src}
        alt=""
        width={96}
        height={96}
        loading="lazy"
        className="h-20 w-20 shrink-0 rounded-full object-cover"
      />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-secondary">
          Written by
        </p>
        <p className="mt-1 font-heading text-h5">
          {provider.name}, {provider.credentials}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {provider.role} with over 15 years of clinical experience across critical care, primary
          care and mental health.
        </p>
        <Link
          href="/bio"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-text-link"
        >
          Read full bio →
        </Link>
      </div>
    </aside>
  );
}
