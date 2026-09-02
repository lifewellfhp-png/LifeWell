import Link from 'next/link';
import { cn, isExternal } from '@/lib/utils';

/**
 * Live-site "swap button": pill label + detached circular arrow.
 * Hover fills both pieces with the secondary green.
 */
export function SwapButton({
  href,
  children,
  className,
  fullWidth,
  size = 'md',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
  size?: 'md' | 'sm';
}) {
  const classes = cn(
    'group inline-flex max-w-full items-center',
    fullWidth && 'w-full',
    className
  );

  const compact = size === 'sm';
  const pill = cn(
    'inline-flex min-w-0 max-w-[calc(100%-44px)] items-center justify-center rounded-[30px] bg-[var(--lw-primary)] font-semibold leading-[1.3] text-white no-underline transition-colors duration-300 group-hover:bg-[var(--lw-accent)] sm:max-w-none',
    compact
      ? 'min-h-[40px] px-5 py-2 text-[14px]'
      : 'min-h-[51px] px-[30px] py-[14px] text-[16px] min-[1181px]:text-[18px]'
  );

  const chip = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--lw-primary)] text-white transition-colors duration-300 group-hover:bg-[var(--lw-accent)]',
    compact ? 'size-10' : 'size-11 sm:size-[51px]'
  );

  const inner = (
    <>
      <span className={cn(pill, fullWidth && 'flex-1')}>{children}</span>
      <span aria-hidden="true" className={chip}>
        <LongArrow />
      </span>
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

/**
 * Secondary "outline" CTA. `variant` reproduces the site's existing outline
 * treatments byte-for-byte rather than inventing a new look:
 *   - `onImage` (default) — white border/text; hover fills border+background
 *     with the primary color. Matches the homepage Hero's original usage.
 *   - `onDark` — white border/text; hover fills the background white and
 *     turns the text primary-colored. Matches the CTASection/New Patients/
 *     Preceptorship closing-band "Contact Us"/"How It Works" buttons.
 *   - `onLight` — primary-colored border/text; hover fills the background
 *     primary and turns the text white. Matches the light-background hero
 *     secondary actions (Preceptorship, New Patients).
 * `showArrow` defaults to true (the Hero's original always-shown arrow);
 * pass false for the plain-text buttons above, none of which show one today.
 */
export function OutlineButton({
  href,
  children,
  className,
  variant = 'onImage',
  showArrow = true,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'onImage' | 'onDark' | 'onLight';
  showArrow?: boolean;
}) {
  const variantClasses: Record<typeof variant, string> = {
    onImage: 'border-white text-white hover:border-[var(--lw-primary)] hover:bg-[var(--lw-primary)]',
    onDark: 'border-white text-white hover:bg-white hover:text-[var(--lw-primary)]',
    onLight: 'border-[var(--lw-primary)] text-[var(--lw-primary)] hover:bg-[var(--lw-primary)] hover:text-white',
  };

  return (
    <Link
      href={href}
      prefetch
      className={cn(
        'inline-flex min-h-[51px] items-center justify-center gap-2 whitespace-nowrap rounded-[30px] border px-[30px] py-[14px] text-[16px] font-semibold leading-[1.3] no-underline transition-colors duration-300 min-[1181px]:text-[18px]',
        variantClasses[variant],
        className
      )}
    >
      {children}
      {showArrow && <LongArrow />}
    </Link>
  );
}

export function LongArrow() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 448 512"
      fill="currentColor"
    >
      <path d="M313.941 216H12c-6.627 0-12 5.373-12 12v56c0 6.627 5.373 12 12 12h301.941v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.569 0-33.941l-86.059-86.059c-15.119-15.119-40.971-4.411-40.971 16.971V216z" />
    </svg>
  );
}
