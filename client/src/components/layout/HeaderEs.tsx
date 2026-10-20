'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Close the mobile panel whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onDown);
    };
  }, [mobileOpen]);

  const overlay = isHome && !scrolled;
  const logo = logoUrl || '/images/brand/logo-v2.avif';

  return (
    <header
      ref={panelRef}
      className={cn(
        'z-50 w-full overflow-x-clip transition-[background-color,box-shadow] duration-300',
        isHome ? 'fixed top-0' : 'sticky top-0',
        overlay ? 'bg-transparent' : 'bg-white shadow-[0_5px_10px_0_rgb(0_0_0/0.03)]'
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex min-h-[72px] w-full max-w-header min-w-0 items-center gap-3 px-4 py-3 sm:min-h-[90px] sm:gap-4 sm:px-[30px] sm:py-5 lg:gap-5 lg:px-10 lg:py-[22px]">
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

        <nav aria-label="Navegación principal" className="hidden flex-1 flex-wrap justify-end gap-x-5 gap-y-2 sm:flex">
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

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          <div className="hidden sm:block">
            <LanguageSwitcher currentLocale="es" overlay={overlay} />
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="es-mobile-menu"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            className={cn(
              'relative z-10 inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-sm border px-3 text-sm font-semibold transition-colors duration-150 sm:hidden',
              overlay
                ? 'border-white/50 text-white hover:bg-white/10'
                : 'border-border-subtle text-text-primary hover:bg-surface-muted'
            )}
          >
            <BurgerIcon />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          id="es-mobile-menu"
          className="border-t border-black/5 bg-white px-4 py-3 shadow-[0_8px_16px_rgba(0,0,0,0.06)] sm:hidden"
        >
          <nav aria-label="Navegación principal" className="flex flex-col gap-1">
            {ES_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={cn(
                  'flex min-h-11 items-center rounded-sm px-2 text-[15px] font-semibold no-underline',
                  pathname === item.href
                    ? 'bg-[#EEF2FA] text-[var(--lw-accent)]'
                    : 'text-[var(--lw-primary)] hover:bg-[#EEF2FA]'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-2 border-t border-black/5 pt-2">
            <LanguageSwitcher currentLocale="es" overlay={false} />
          </div>
        </div>
      )}
    </header>
  );
}

function BurgerIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M2 4.5h14M2 9h14M2 13.5h14" />
    </svg>
  );
}
