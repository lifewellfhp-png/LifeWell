/**
 * Tasteful branded placeholder shown in place of a cover image until one is
 * uploaded in Admin -> Blog -> Cover image URL. Navy-to-green gradient
 * (matching the logo palette) with the post's topic/category centered.
 */
export function BlogCoverPlaceholder({ category }: { category: string | null }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center p-6 text-center"
      style={{ background: 'linear-gradient(135deg, var(--lw-primary) 0%, var(--lw-accent) 100%)' }}
    >
      <span className="font-heading text-[18px] font-normal leading-tight text-white sm:text-[20px]">
        {category || 'LifeWell'}
      </span>
    </div>
  );
}
