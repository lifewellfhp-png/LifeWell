import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Container, Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { JsonLd } from '@/components/seo/JsonLd';

import { serviceSummaries } from '@/data/service-catalog';
import { formatDate, isoDate } from '@/lib/utils';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';
import { CmsCta } from '@/components/CmsCta';

const DESCRIPTION =
  'The LifeWell Wellness Resource Hub — practical, evidence-informed guidance on anxiety, depression, ADHD, sleep, and whole-person mental health from LifeWell Family Health & Psychiatry.';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Wellness Resource Hub — Mental Health & Wellness Insights',
    description: DESCRIPTION,
    path: '/blog',
    noIndex: cms.posts.length === 0,
  });
}

/** Lists published CMS articles from the API — never static placeholder posts. */
export default async function BlogIndexPage() {
  const cms = await getResolvedContent();
  const posts = cms.posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt || '',
    category: post.category ?? null,
    image: post.coverImageUrl,
    publishedAt: post.publishedAt,
    href: `/blog/${post.slug}`,
  }));

  return (
    <>
      <JsonLd
        data={pageGraph('/blog', 'Wellness Resource Hub', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'Wellness Resource Hub', href: '/blog' },
        ])}
        id="blog-schema"
      />

      <InnerPageHero
        title="Wellness"
        accent="Resource Hub"
        lead="Practical, evidence-informed guidance on mental health, written by a board-certified psychiatric nurse practitioner."
        leadSize="subhead"
      />

      <Section tone="base">
        <Container>
          {posts.length > 0 ? (
            <ul className="grid list-none gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <li key={post.slug} className="flex">
                  <article className="group flex w-full flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-raised transition-shadow duration-fast hover:shadow-md">
                    {post.image && (
                      <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted">
                        {post.image.startsWith('http') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <Image
                            src={post.image}
                            alt=""
                            fill
                            loading="lazy"
                            sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 92vw"
                            className="object-cover"
                          />
                        )}
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      {post.category && (
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-brand-primary-solid">
                          {post.category}
                        </p>
                      )}
                      <h2 className="text-h5">
                        <Link
                          href={post.href}
                          className="text-text-primary no-underline after:absolute after:inset-0 after:content-[''] group-hover:text-brand-primary-solid"
                        >
                          {post.title}
                        </Link>
                      </h2>
                      {post.excerpt && (
                        <p className="mt-3 flex-1 text-sm leading-relaxed text-text-secondary">
                          {post.excerpt}
                        </p>
                      )}
                      {post.publishedAt && (
                        <p className="mt-5 text-xs text-text-secondary">
                          <time dateTime={isoDate(post.publishedAt)}>
                            {formatDate(post.publishedAt)}
                          </time>
                        </p>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState />
          )}
        </Container>
      </Section>

      <CmsCta />
    </>
  );
}

/** Shown while no article has publishable content. */
function EmptyState() {
  const suggested = serviceSummaries.slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-md border border-border-subtle bg-surface-raised px-5 py-8 text-center sm:px-8 sm:py-12">
        <span
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary-soft text-brand-primary-solid"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 4h11l3 3v13H5z" />
            <path d="M8 9h7M8 13h7M8 17h4" />
          </svg>
        </span>

        <h2 className="mt-6 text-h4">New articles are on the way</h2>
        <p className="mx-auto mt-4 max-w-[56ch] text-text-secondary">
          We’re preparing a library of practical mental health writing. In the meantime, the
          service pages below cover the most common questions, and you’re always welcome to get in
          touch directly.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Button href="/our-services" size="lg">
            Explore services
          </Button>
          <Button href="/faqs" variant="outline" size="lg">
            Read the FAQs
          </Button>
        </div>
      </div>

      <ul className="mt-8 grid list-none gap-4 sm:grid-cols-3">
        {suggested.map((s) => (
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
