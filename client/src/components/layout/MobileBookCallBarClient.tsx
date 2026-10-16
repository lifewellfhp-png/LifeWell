'use client';

import { usePathname } from 'next/navigation';
import { trackConversion } from '@/lib/cms';
import { cn } from '@/lib/utils';

/**
 * Fixed-bottom mobile-only strip (hidden at `sm:` and up, where the header's
 * own CTA is already visible and reachable). Two calm, equal-weight actions
 * — Book and Call — never competing for space against page content: body
 * padding for its height is added globally (see globals.css's
 * `--mobile-book-bar-height` use in `main`/`footer` scroll-margin).
 */
export function MobileBookCallBarClient({
  phone,
  bookingHref,
  bookingLabel,
}: {
  phone: string;
  bookingHref: string;
  bookingLabel: string;
}) {
  const pathname = usePathname();
  const digits = phone.replace(/\D/g, '').replace(/^1/, '');
  const phoneHref = digits ? `tel:+1${digits}` : 'tel:+14076031717';

  // Already on the booking page itself — a sticky "Book" action pointing at
  // the page the visitor is already looking at is just noise.
  if (pathname.startsWith('/book-telehealth-mental-health-appointment')) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-px border-t border-border-subtle bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(20,40,60,0.08)] backdrop-blur sm:hidden'
      )}
    >
      <a
        href={phoneHref}
        className="flex min-h-14 flex-1 items-center justify-center gap-2 text-[15px] font-semibold text-brand-primary-solid no-underline"
      >
        <PhoneIcon />
        Call
      </a>
      <a
        href={bookingHref}
        onClick={() => void trackConversion('booking_click', pathname)}
        className="flex min-h-14 flex-[1.4] items-center justify-center gap-2 bg-[var(--lw-primary)] text-[15px] font-semibold text-white no-underline"
      >
        <CalendarIcon />
        {bookingLabel || 'Book'}
      </a>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
