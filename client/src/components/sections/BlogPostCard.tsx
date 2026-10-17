import Image from 'next/image';
import Link from 'next/link';
import { isOptimizableImageSrc } from '@/lib/site-asset';
import { formatDate, isoDate, estimateReadingTime } from '@/lib/utils';
import { BlogCoverPlaceholder } from './BlogCoverPlaceholder';

export type BlogCardPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  body: string | null;
};

/** Standard grid card, also reused for "Related articles" on individual post pages. */
export function BlogPostCard({ post }: { post: BlogCardPost }) {
  const readingTime = estimateReadingTime(post.body);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[20px] border-t-4 border-[var(--lw-accent)] bg-white no-underline shadow-[0_8px_24px_rgb(0_37_116_/_0.08)] transition-shadow duration-300 hover:shadow-[0_12px_32px_rgb(0_37_116_/_0.12)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#EEF2FA]">
        {post.coverImageUrl ? (
          isOptimizableImageSrc(post.coverImageUrl) ? (
            <Image
              src={post.coverImageUrl}
              alt=""
              fill
              loading="lazy"
              sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 92vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverImageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          )
        ) : (
          <BlogCoverPlaceholder category={post.category} />
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        {post.category && (
          // Diagnostic: #028815 on this #EEF3F7 background is 4.14:1
          // (needs 4.5:1) at this size — text-brand-accent-strong clears it.
          <span className="mb-2.5 w-fit rounded-[7px] bg-[#EEF3F7] px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-brand-accent-strong">
            {post.category}
          </span>
        )}
        <h3 className="font-heading text-[20px] font-normal leading-[1.25] text-[var(--lw-primary)] sm:text-[22px]">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-2 line-clamp-2 flex-1 text-[14px] leading-[1.45] text-[#374151]">{post.excerpt}</p>
        )}
        <p className="mt-4 text-[12px] text-[#6B7280]">
          {post.publishedAt && <time dateTime={isoDate(post.publishedAt)}>{formatDate(post.publishedAt)}</time>}
          {post.publishedAt ? ' · ' : ''}
          {readingTime} min read
        </p>
      </div>
    </Link>
  );
}
