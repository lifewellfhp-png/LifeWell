'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { site } from '@/data/site';
import { headerNav, headerCta } from '@/data/navigation';
import { cn } from '@/lib/utils';
import { isOptimizableImageSrc } from '@/lib/site-asset';
import { NavBar } from './NavBar';

/**
 * Live header is absolutely positioned over the hero (transparent), then
 * fills white once the visitor starts scrolling — Headroom `not-top`.
 */
export function Header({
  cta,
  logoUrl,
  phone,
}: {
  cta?: { label: string; href: string };
  logoUrl?: string | null;
  phone?: string | null;
} = {}) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const overlay = isHome && !scrolled;
  const button = cta ?? headerCta;
  const logo = logoUrl || '/images/brand/logo-v2.avif';
  const optimizableLogo = isOptimizableImageSrc(logo);

  return (
    <header
      className={cn(
        'z-50 w-full overflow-x-clip transition-[background-color,box-shadow] duration-300',
        isHome ? 'fixed top-0' : 'sticky top-0',
        overlay
          ? 'bg-transparent'
          : 'bg-white shadow-[0_5px_10px_0_rgb(0_0_0/0.03)]'
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/*
        Phase 23 premium redesign: the header now genuinely shrinks once
        scrolled (min-height + vertical padding both step down), not just a
        background-color swap — the transition on min-height/padding is
        listed explicitly alongside the header's own background/shadow
        transition above so both animate together. On non-home pages
        `scrolled` is always true (no hero to sit over), so inner pages get
        the compact header permanently, matching what a visitor would see
        after scrolling the homepage anyway.
      */}
      <div
        className={cn(
          'mx-auto flex w-full max-w-header min-w-0 items-center gap-3 px-4 transition-[min-height,padding] duration-300 sm:max-[1601px]:gap-4 sm:max-[1601px]:px-[30px] lg:max-[1601px]:gap-5 lg:max-[1601px]:px-10 min-[1601px]:gap-[30px] min-[1601px]:px-[70px]',
          scrolled
            ? 'min-h-[64px] py-2 sm:min-h-[72px] sm:max-[1601px]:py-3 lg:min-h-[80px] lg:max-[1601px]:py-[14px] min-[1601px]:py-4'
            : 'min-h-[72px] py-3 sm:min-h-[90px] sm:max-[1601px]:py-5 lg:min-h-[110px] lg:max-[1601px]:py-[22px] min-[1601px]:py-[30px]'
        )}
      >
        <Link
          href="/"
          prefetch
          className="relative z-10 shrink-0 no-underline"
          aria-label={`${site.name} — home`}
        >
          {optimizableLogo ? (
            <Image
              src={logo}
              alt={site.name}
              width={945}
              height={191}
              priority
              className={cn(
                'w-auto max-w-[min(11rem,46vw)] object-contain object-left transition-[height] duration-300 sm:max-w-none',
                scrolled ? 'h-8 sm:h-9 lg:h-10' : 'h-9 sm:h-11 lg:h-[50px]'
              )}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={site.name}
              fetchPriority="high"
              className={cn(
                'w-auto max-w-[min(11rem,46vw)] object-contain object-left transition-[height] duration-300 sm:max-w-none',
                scrolled ? 'h-8 sm:h-9 lg:h-10' : 'h-9 sm:h-11 lg:h-[50px]'
              )}
            />
          )}
        </Link>

        <NavBar items={headerNav} cta={button} overlay={overlay} phone={phone} />
      </div>
    </header>
  );
}
