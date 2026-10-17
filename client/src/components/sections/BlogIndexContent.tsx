'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/ui/Section';
import { BlogPostCard, type BlogCardPost } from '@/components/sections/BlogPostCard';
import { BlogCoverPlaceholder } from '@/components/sections/BlogCoverPlaceholder';
import { isOptimizableImageSrc } from '@/lib/site-asset';
import { cn, formatDate, isoDate, estimateReadingTime } from '@/lib/utils';
import { BLOG_FILTER_CATEGORIES, BLOG_PAGE_SIZE } from '@/lib/blog';

/**
 * Premium /blog reorg: search + category chips + a large featured card for
 * the newest post + a 3-column grid of the rest, paginated once the grid
 * passes BLOG_PAGE_SIZE. All client-side — the full post list (currently 6
 * posts) is passed down from the server page in one shot, no extra fetch.
 *
 * The featured card and category chips only make sense against the
 * unfiltered set, so search/filtering replaces the whole featured+grid
 * area with a single flat, paginated grid instead.
 */
export function BlogIndexContent({ posts }: { posts: BlogCardPost[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [page, setPage] = useState(1);

  const sorted = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return bt - at;
      }),
    [posts]
  );

  const filtersActive = query.trim().length > 0 || category !== 'All';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((p) => {
      if (category !== 'All' && p.category !== category) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || (p.excerpt ?? '').toLowerCase().includes(q);
    });
  }, [sorted, query, category]);

  const featured = !filtersActive ? sorted[0] : undefined;
  const gridPosts = filtersActive ? filtered : sorted.slice(1);

  const totalPages = Math.max(1, Math.ceil(gridPosts.length / BLOG_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagePosts = gridPosts.slice((currentPage - 1) * BLOG_PAGE_SIZE, currentPage * BLOG_PAGE_SIZE);

  function updateQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  function updateCategory(next: string) {
    setCategory(next);
    setPage(1);
  }

  return (
    <>
      <section className="px-5 pb-10 sm:max-[1601px]:px-[30px] lg:max-[1601px]:px-10 min-[1601px]:px-[80px]">
        <Container>
          <div className="mx-auto max-w-[640px]">
            <label htmlFor="blog-search" className="sr-only">
              Search articles
            </label>
            <div className="relative">
              <SearchIcon />
              <input
                id="blog-search"
                type="search"
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                placeholder="Search articles…"
                className="w-full rounded-[30px] border border-[#DCE7E9] bg-white py-3 pl-11 pr-5 text-[15px] text-[#374151] outline-none transition-colors duration-200 focus:border-[var(--lw-primary)]"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {['All', ...BLOG_FILTER_CATEGORIES].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateCategory(c)}
                aria-pressed={category === c}
                className={cn(
                  'rounded-[30px] px-5 py-2 text-[13px] font-semibold transition-colors duration-200',
                  category === c
                    ? 'bg-[var(--lw-primary)] text-white'
                    : 'bg-[#EEF2FA] text-[var(--lw-primary)] hover:bg-[#DCE7E9]'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Container>
      </section>

      {featured && (
        <section className="px-5 pb-12 sm:max-[1601px]:px-[30px] lg:max-[1601px]:px-10 min-[1601px]:px-[80px]">
          <Container>
            <FeaturedPostCard post={featured} />
          </Container>
        </section>
      )}

      <section className="px-5 pb-16 sm:max-[1601px]:px-[30px] sm:pb-24 lg:max-[1601px]:px-10 min-[1601px]:px-[80px]">
        <Container>
          {pagePosts.length > 0 ? (
            <>
              <ul className="grid list-none gap-8 md:grid-cols-2 lg:grid-cols-3">
                {pagePosts.map((post) => (
                  <li key={post.slug}>
                    <BlogPostCard post={post} />
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <nav aria-label="Blog pagination" className="mt-12 flex items-center justify-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-current={n === currentPage ? 'page' : undefined}
                      onClick={() => setPage(n)}
                      className={cn(
                        'flex size-10 items-center justify-center rounded-full text-[14px] font-semibold transition-colors duration-200',
                        n === currentPage
                          ? 'bg-[var(--lw-primary)] text-white'
                          : 'bg-[#EEF2FA] text-[var(--lw-primary)] hover:bg-[#DCE7E9]'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </nav>
              )}
            </>
          ) : (
            <p className="text-center text-[16px] text-[#6B7280]">No articles match your search.</p>
          )}
        </Container>
      </section>
    </>
  );
}

function FeaturedPostCard({ post }: { post: BlogCardPost }) {
  const readingTime = estimateReadingTime(post.body);
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-[20px] border-t-4 border-[var(--lw-accent)] bg-white no-underline shadow-[0_8px_24px_rgb(0_37_116_/_0.08)] transition-shadow duration-300 hover:shadow-[0_12px_32px_rgb(0_37_116_/_0.12)] lg:flex-row"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#EEF2FA] lg:aspect-auto lg:w-[48%]">
        {post.coverImageUrl ? (
          isOptimizableImageSrc(post.coverImageUrl) ? (
            <Image
              src={post.coverImageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 48vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )
        ) : (
          <BlogCoverPlaceholder category={post.category} />
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center p-7 sm:p-10">
        {/* Diagnostic: #028815 on this #EEF3F7 background is 4.14:1
            (needs 4.5:1) at this size — text-brand-accent-strong clears it. */}
        <span className="mb-3 w-fit rounded-[7px] bg-[#EEF3F7] px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-brand-accent-strong">
          {post.category || 'Latest'}
        </span>
        <h2 className="font-heading text-[26px] font-normal leading-[1.2] text-[var(--lw-primary)] sm:text-[32px]">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-4 max-w-[60ch] text-[15px] leading-[1.5] text-[#374151] sm:text-[16px]">{post.excerpt}</p>
        )}
        <p className="mt-5 text-[13px] text-[#6B7280]">
          {post.publishedAt && <time dateTime={isoDate(post.publishedAt)}>{formatDate(post.publishedAt)}</time>}
          {post.publishedAt ? ' · ' : ''}
          {readingTime} min read
        </p>
        <span className="mt-5 inline-flex w-fit items-center gap-2 text-[15px] font-semibold text-[var(--lw-accent)]">
          Read article <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9AA6B2"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
