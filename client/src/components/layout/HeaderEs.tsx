'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { site } from '@/data/site';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * Spanish header — a deliberately smaller set of core links than the
 * English NavBar's full mega-menu (which lists every service/condition
 * individually). Translating that entire menu was out of scope for this
 * pass; this covers the pages Part 3 actually translates. Same visual
 * language (overlay-on-hero, scroll-to-solid) as Header.tsx, since it's
 * the same design system.
 */
const ES_NAV = [
  { label: 'Inicio', href: '/es' },
  { label: 'Servicios', href: '/es/our-services' },
  { label: 'Tarifas y Seguro', href: '/es/fees-insurance' },
  { label: 'Preguntas Frecuentes', href: '/es/faqs' },
  { label: 'Contacto', href: '/es/contact-telehealth-mental-health-provider' },
] as const;

export function HeaderEs({ logoUrl }: { logoUrl?: string | null } = {}) {
  const pathname = usePathname();
  const isHome = pathname === '/es';
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
  const logo = logoUrl || '/images/brand/logo-v2.avif';

  return (
    <header
      className={cn(
        'z-50 w-full overflow-x-clip transition-[background-color,box-shadow] duration-300',
        isHome ? 'fixed top-0' : 'sticky top-0',
        overlay ? 'bg-transparent' : 'bg-white shadow-[0_5px_10px_0_rgb(0_0_0/0.03)]'
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex min-h-[72px] w-full max-w-header min-w-0 flex-wrap items-center gap-3 px-4 py-3 sm:min-h-[90px] sm:flex-nowrap sm:gap-4 sm:px-[30px] sm:py-5 lg:gap-5 lg:px-10 lg:py-[22px]">
        <Link href="/es" prefetch className="relative z-10 shrink-0 no-underline" aria-label={`${site.name} — inicio`}>
          <Image
            src={logo}
            alt={site.name}
            width={945}
            height={191}
            priority
            className="h-9 w-auto max-w-[min(11rem,46vw)] object-contain object-left sm:h-11 lg:h-[50px]"
          />
        </Link>

        <nav aria-label="Navegación principal" className="order-3 flex w-full flex-wrap gap-x-5 gap-y-2 sm:order-none sm:w-auto sm:flex-1 sm:justify-end">
          {ES_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={cn(
                'text-[14px] font-semibold no-underline hover:underline',
                overlay ? 'text-white' : 'text-[var(--lw-primary)]'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="shrink-0">
          <LanguageSwitcher currentLocale="es" overlay={overlay} />
        </div>
      </div>
    </header>
  );
}
