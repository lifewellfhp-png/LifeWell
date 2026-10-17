'use client';

import Link from 'next/link';
import { trackConversion } from '@/lib/cms';
import { LongArrow } from '@/components/ui/SwapButton';
import { cn } from '@/lib/utils';

/**
 * /fees-insurance reorg: every button on this page is a single integrated
 * pill with the arrow inside it — same shape as HeroBookButton, generalized
 * here with a `tone` so this one component covers both the solid green
 * "Book an Appointment" actions and the outline "Verify My Insurance"
 * action. Hero.tsx is left untouched (still uses its own HeroBookButton) —
 * this is a separate component so the already-shipped homepage isn't
 * touched by this page's changes.
 */
export function FeesPillButton({
  href,
  children,
  tone = 'accent',
  trackAs,
}: {
  href: string;
  children: React.ReactNode;
  tone?: 'accent' | 'primary' | 'outline';
  trackAs?: 'booking_click';
}) {
  const onClick = trackAs
    ? () => void trackConversion(trackAs, typeof window !== 'undefined' ? window.location.pathname : undefined)
    : undefined;

  const toneClasses =
    tone === 'accent'
      ? 'bg-[var(--lw-accent)] text-white hover:bg-[var(--color-brand-accent-hover)]'
      : tone === 'primary'
        ? 'bg-[var(--lw-primary)] text-white hover:bg-[var(--color-brand-primary-hover)]'
        : 'border border-[var(--lw-primary)] bg-transparent text-[var(--lw-primary)] hover:bg-[var(--lw-primary)] hover:text-white';

  return (
    <Link
      href={href}
      prefetch
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[51px] items-center justify-center gap-2.5 whitespace-nowrap rounded-[30px] px-[30px] py-[14px] text-[16px] font-semibold leading-[1.3] no-underline transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lw-primary)] desktop:text-[18px]',
        toneClasses
      )}
    >
      {children}
      <LongArrow />
    </Link>
  );
}
