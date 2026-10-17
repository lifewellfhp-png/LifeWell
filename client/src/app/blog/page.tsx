import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { BlogIndexContent } from '@/components/sections/BlogIndexContent';
import { JsonLd } from '@/components/seo/JsonLd';

import { serviceSummaries } from '@/data/service-catalog';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';
import { CmsCta } from '@/components/CmsCta';

const DESCRIPTION =
  'The LifeWell Wellness Resource Hub — practical, evidence-informed guidance on anxiety, depression, ADHD, sleep, and whole-person mental health.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Mental Health & Wellness Resource Hub | LifeWell FHP',
    description: DESCRIPTION,
    path: '/blog',
    noIndex: cms.posts.length === 0,
  });
}

/**
 * Premium /blog reorg: hero (unchanged heading/lead) -> search + category
 * chips -> featured newest post -> 3-column grid, paginated past 9 -> the
 * existing bottom CTA band (CmsCta: "Start Your Mental Wellness Journey
 * Today") and global newsletter band (Footer.tsx) are untouched. Lists
 * published CMS articles from the API — never static placeholder posts.
 */
export default async function BlogIndexPage() {
  const cms = await getResolvedContent();
  const posts = cms.posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt || null,
    category: post.category ?? null,
    coverImageUrl: post.coverImageUrl ?? null,
    publishedAt: post.publishedAt ?? null,
    body: post.body ?? null,
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

      {posts.length > 0 ? (
        <BlogIndexContent posts={posts} />
      ) : (
        <Section tone="base">
          <Container>
            <EmptyState />
          </Container>
        </Section>
      )}

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
