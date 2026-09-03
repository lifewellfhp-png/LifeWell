'use client';

import { trackConversion } from '@/lib/cms';

/**
 * A plain anchor that needs booking_click tracking but isn't a SwapButton/
 * HeaderCta (e.g. BioPageContent's "Working Shifts" tiles, which link
 * straight to booking but render their own bespoke markup). Kept as its own
 * tiny client-component leaf so the Server Component page/section that
 * renders it doesn't need to become a Client Component itself.
 */
export function TrackedBookingLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() =>
        void trackConversion('booking_click', typeof window !== 'undefined' ? window.location.pathname : undefined)
      }
    >
      {children}
    </a>
  );
}
