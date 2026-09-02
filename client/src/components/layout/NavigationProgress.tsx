'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PREFETCH_ROUTES } from '@/data/service-catalog';
import { isExternal } from '@/lib/utils';

/**
 * Instant nav feedback + warmup.
 *
 * Next.js App Router waits for the RSC payload before swapping the page.
 * This paints a top bar on the click itself, and prefetches primary routes
 * after idle so the next click is typically already in cache.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || isExternal(href) || href.startsWith('#') || anchor.target === '_blank') return;

      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname && url.hash) return;
      if (url.pathname === pathname && url.search === window.location.search) return;

      setPending(true);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      for (const href of PREFETCH_ROUTES) {
        router.prefetch(href);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router]);

  if (!pending) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] overflow-hidden bg-transparent"
      aria-hidden="true"
    >
      <div className="nav-progress-bar h-full w-full origin-left bg-[var(--lw-primary)]" />
    </div>
  );
}
