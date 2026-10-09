'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView, trackConversion } from '@/lib/cms';
import { site } from '@/data/site';

/** Privacy-focused page-view beacon (path + device + referrer host only). */
export function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    void trackPageView(pathname);
  }, [pathname]);

  // Document-level delegation covers every current and future tel: link
  // (header, footer, contact page, bio, chat widget, etc.) from one place.
  // The 988 crisis line is excluded on purpose — it is never a business
  // lead and must never be reported as an ad conversion.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href^="tel:"]');
      if (!link) return;
      const href = link.getAttribute('href') ?? '';
      if (href === site.crisis.phoneHref) return;
      void trackConversion('phone_click', window.location.pathname);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
