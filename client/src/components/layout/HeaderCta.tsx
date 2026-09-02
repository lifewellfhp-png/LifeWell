import Link from 'next/link';
import { cn, isExternal } from '@/lib/utils';
import { LongArrow } from '@/components/ui/SwapButton';

/**
 * Header-only "Book an Appointment" control — a single integrated pill with
 * the arrow inside it, unlike the site-wide `SwapButton` (pill + a visually
 * detached circular arrow chip). Kept local to the header so the shared
 * `SwapButton` used everywhere else on the site is untouched.
 */
export function HeaderCta({
  href,
  children,
  size = 'md',
  fullWidth,
  overlay,
  className,
}: {
  href: string;
  children: React.ReactNode;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
  overlay?: boolean;
  className?: string;
}) {
  const compact = size === 'sm';
  const classes = cn(
    'inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-[30px] bg-[var(--lw-primary)] font-semibold leading-none text-white no-underline transition-colors duration-300 hover:bg-[var(--lw-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lw-primary)]',
    overlay && 'focus-visible:outline-white',
    compact
      ? 'min-h-[40px] px-5 text-[14px]'
      : 'min-h-[46px] px-6 text-[15px] min-[1601px]:min-h-[48px] min-[1601px]:px-7 min-[1601px]:text-[16px]',
    fullWidth && 'w-full',
    className
  );

  const inner = (
    <>
      {children}
      <LongArrow />
    </>
  );

  if (isExternal(href)) {
    const externalTab = /^https?:/.test(href);
    return (
      <a
        href={href}
        {...(externalTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={classes}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} prefetch className={classes}>
      {inner}
    </Link>
  );
}
