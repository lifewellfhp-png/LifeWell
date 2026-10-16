'use client';

import Link from 'next/link';
import { trackConversion } from '@/lib/cms';
import { LongArrow } from '@/components/ui/SwapButton';

/**
 * Hero-only "Book an Appointment" button (Phase 24 homepage reorg) — a
 * single integrated pill with the arrow inside it, like HeaderCta.tsx,
 * rather than the site-wide SwapButton's pill + detached circular chip.
 * Solid green (--lw-accent), no opacity/filters. A dedicated client
 * component (not inline in Hero.tsx) because Hero.tsx itself is a server
 * component — same reason SwapButton/OutlineButton/HeaderCta each exist
 * as their own small client components rather than living inline in the
 * server components that use them.
 */
export function HeroBookButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch
      onClick={() =>
        void trackConversion('booking_click', typeof window !== 'undefined' ? window.location.pathname : undefined)
      }
      className="inline-flex min-h-[51px] items-center justify-center gap-2.5 whitespace-nowrap rounded-[30px] bg-[var(--lw-accent)] px-[30px] py-[14px] text-[16px] font-semibold leading-[1.3] text-white no-underline transition-colors duration-300 hover:bg-[var(--color-brand-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white desktop:text-[18px]"
    >
      {label}
      <LongArrow />
    </Link>
  );
}
