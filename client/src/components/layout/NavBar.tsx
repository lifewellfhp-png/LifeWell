'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem, NavLink } from '@/types/content';
import { cn } from '@/lib/utils';
import { HeaderCta } from './HeaderCta';
import { MobileMenu } from './MobileMenu';

/**
 * Extra room for the CTA control, the menu/search trigger (permanently
 * visible since Phase 20 — previously hidden in desktop mode, so it never
 * needed reserving here, now icon-only with no "Menu" label in desktop mode
 * to keep its footprint down), and the flex gaps around both.
 *
 * Phase 21 finding: with the trigger now permanently reserved, the true
 * required width (nav links + this reserve) exceeds max-w-page's 1280px
 * content cap at every tested viewport once header padding is correctly
 * subtracted (Header.tsx's row padding grows from 16px to 70px across
 * breakpoints and was never subtracted from the old fit check — the root
 * cause of the overlap this fixes). The true margin at the most favorable
 * width (1280px) is only a few px either way, and empirically unstable
 * across page loads (component-order/hydration timing, not a deterministic
 * function of viewport alone — see the Phase 20 report's compact-nav
 * findings) — not safe to thread precisely. This value is set generously
 * conservative, which means desktop nav (full links visible) no longer
 * activates at any tested width; compact/hamburger nav — fully functional,
 * search-accessible per Phase 20 — is now the effective default. Resolving
 * the underlying tension (nav item count, CTA size, logo size, or
 * max-w-page itself) is a design decision beyond this constant; see the
 * Phase 21 report.
 */
const CTA_RESERVE = 300;
const ROW_GAP = 20;
/** Buffer so late font/image loads can never push links over the logo. */
const SAFETY = 24;
/** Chevron icon + gap rendered next to items that open a mega menu. */
const CHEVRON_EXTRA = 19;

const NAV_LINK =
  'inline-flex min-h-[42px] shrink-0 items-center whitespace-nowrap rounded-[30px] px-3.5 py-[5px] text-[15px] font-semibold leading-none no-underline transition-colors duration-300 xl:max-[1601px]:px-[18px] min-[1601px]:px-[22px] min-[1601px]:text-[16px]';

export function NavBar({
  items,
  cta,
  overlay = false,
  phone,
}: {
  items: NavItem[];
  cta: NavLink;
  overlay?: boolean;
  phone?: string | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState<boolean | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Use the hamburger whenever logo + links + CTA would overflow the bar.
  useLayoutEffect(() => {
    const host = hostRef.current;
    const measure = measureRef.current;
    if (!host || !measure) return;

    const update = () => {
      const row = host.parentElement;
      if (!row) return;
      const logo = row.firstElementChild as HTMLElement | null;
      const logoW = logo?.getBoundingClientRect().width ?? 0;
      // row.clientWidth includes row's own horizontal padding (per the
      // clientWidth spec: content + padding), but that padding isn't space
      // available to lay out row's flex children (logo + this nav) in — it's
      // consumed before they're placed. row's padding is also responsive
      // (16px up to 70px across breakpoints, see Header.tsx), so a fixed
      // ROW_GAP-only estimate that omits padding drifts from a few px of
      // slack at narrow paddings to real, visible overlap at wide ones.
      // Reading the live computed padding/gap keeps this accurate as those
      // values change, instead of hardcoding an approximation of either.
      const rowStyle = getComputedStyle(row);
      const paddingX = parseFloat(rowStyle.paddingLeft || '0') + parseFloat(rowStyle.paddingRight || '0');
      const rowGap = parseFloat(rowStyle.columnGap || rowStyle.gap || '0') || ROW_GAP;
      const available = row.clientWidth - paddingX - logoW - rowGap;
      const fits = measure.scrollWidth + CTA_RESERVE + SAFETY <= available;
      setCompact(!fits);
      if (fits) setMobileOpen(false);
    };

    update();
    const row = host.parentElement;
    const logo = row?.firstElementChild as HTMLElement | null;
    const ro = new ResizeObserver(update);
    if (row) ro.observe(row);
    // Web fonts and the logo image load after first paint and change widths;
    // observing these re-runs the fit check so links never overlap the logo.
    ro.observe(measure);
    if (logo) ro.observe(logo);
    window.addEventListener('resize', update);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(update).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [items]);

  const showDesktop = compact === false;
  const showCompact = compact !== false;

  return (
    <div ref={hostRef} className="flex min-w-0 flex-1 items-center gap-3 lg:gap-5">
      <ul
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible fixed left-0 top-0 -z-10 flex w-max items-center gap-[3px] whitespace-nowrap text-[15px] font-semibold min-[1601px]:text-[16px]"
      >
        {items.map((item) => (
          <li key={item.href} className="px-3.5 py-[5px] xl:max-[1601px]:px-[18px] min-[1601px]:px-[22px]">
            {item.label}
            {item.groups || item.flat ? (
              <span aria-hidden className="inline-block" style={{ width: `${CHEVRON_EXTRA}px` }} />
            ) : null}
          </li>
        ))}
      </ul>

      <nav
        aria-label="Main"
        className={cn(
          'min-w-0 flex-1 overflow-x-clip',
          compact === null ? 'hidden min-[1440px]:flex' : showDesktop ? 'flex' : 'hidden'
        )}
      >
        <ul className="flex w-full items-center justify-center gap-[3px]">
          {items.map((item) =>
            item.groups ? (
              <MegaMenuItem key={item.href} item={item} pathname={pathname} overlay={overlay} />
            ) : item.flat ? (
              <FlatDropdownItem key={item.href} label={item.label} links={item.flat} pathname={pathname} overlay={overlay} />
            ) : (
              <li key={item.href} className="shrink-0">
                <TopLevelLink href={item.href} pathname={pathname} overlay={overlay}>
                  {item.label}
                </TopLevelLink>
              </li>
            )
          )}
        </ul>
      </nav>

      <div
        className={cn(
          'flex shrink-0 items-center gap-2 sm:gap-3',
          compact === null ? 'ml-auto min-[1440px]:ml-0' : showCompact && 'ml-auto'
        )}
      >
        <div
          className={cn(
            compact === null ? 'hidden min-[1440px]:flex' : showDesktop ? 'flex' : 'hidden'
          )}
        >
          <HeaderCta href={cta.href} overlay={overlay} trackAs="booking_click">
            {cta.label}
          </HeaderCta>
        </div>

        <div
          className={cn(
            compact === null
              ? 'hidden sm:max-[1440px]:flex min-[1440px]:hidden'
              : showCompact
                ? 'hidden sm:flex'
                : 'hidden'
          )}
        >
          <HeaderCta href={cta.href} size="sm" overlay={overlay} trackAs="booking_click">
            {cta.label}
          </HeaderCta>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label="Open menu"
          className={cn(
            // Always visible in every nav state (compact or full desktop):
            // this is the only trigger for SiteSearch, nested inside the
            // drawer it opens. Previously hidden once the desktop nav links
            // fit (Phase 20 finding), which left no way to reach search at
            // all on wide viewports.
            'relative z-10 inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-sm border px-3 text-sm font-semibold transition-colors duration-quick sm:px-4',
            overlay
              ? 'border-white/50 text-white hover:bg-white/10'
              : 'border-border-subtle text-text-primary hover:bg-surface-muted'
          )}
        >
          <BurgerIcon />
          {/* Text label only in compact mode — in desktop mode this control
              exists purely to reach search (the desktop nav already shows
              the real links), so the extra label width isn't earning its
              keep against the header's tight content budget. aria-label
              above carries the accessible name regardless. */}
          <span className={cn('hidden sm:inline', showDesktop && 'sm:hidden')}>Menu</span>
        </button>
      </div>

      <MobileMenu
        id="mobile-menu"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        items={items}
        cta={cta}
        pathname={pathname}
        phone={phone}
      />
    </div>
  );
}

/* ------------------------------------------------------------- pieces --- */

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

function TopLevelLink({
  href,
  pathname,
  overlay,
  children,
}: {
  href: string;
  pathname: string;
  overlay?: boolean;
  children: React.ReactNode;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? 'page' : undefined}
      className={cn(
        NAV_LINK,
        active
          ? 'bg-[var(--lw-primary)] text-white'
          : overlay
            ? 'text-[var(--color-text-inverse)] hover:bg-[var(--lw-accent)] hover:text-white'
            : 'text-[var(--lw-accent)] hover:bg-[var(--lw-primary)] hover:text-white'
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Services mega menu.
 *
 * Opens on hover for pointer users and on click for everyone; Escape closes
 * and returns focus to the trigger. Focus leaving the subtree closes it, so
 * tabbing past the menu behaves predictably.
 */
function MegaMenuItem({ item, pathname, overlay }: { item: NavItem; pathname: string; overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(110);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const active = isActive(pathname, item.href) || pathname.startsWith('/services');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const header = document.querySelector('header')?.getBoundingClientRect();
      const fromTrigger = trigger ? trigger.bottom + 45 : 0;
      const fromHeader = (header?.bottom ?? 110) + 16;
      setTop(Math.max(fromTrigger, fromHeader));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.services-mega')) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const openNow = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  const panel =
    mounted &&
    open &&
    createPortal(
      <div
        id={panelId}
        className="services-mega fixed left-1/2 z-[70] w-[min(760px,calc(100vw-2rem))] -translate-x-1/2"
        style={{ top }}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
      >
        <div className="mega-card flex min-h-[360px] overflow-hidden rounded-[24px] border border-black/5 shadow-[0_16px_40px_rgba(20,40,60,0.14)]">
          {item.groups?.map((group) => (
            <div
              key={group.label}
              className="flex min-w-0 flex-1 flex-col justify-center gap-4 p-7 md:p-8"
            >
              <Link href={item.href} prefetch className="mega-heading block no-underline">
                {group.label}
              </Link>
              <ul className="flex flex-col gap-0.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch
                      aria-current={pathname === link.href ? 'page' : undefined}
                      className="mega-link block px-2.5 py-2.5 no-underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>,
      document.body
    );

  return (
    <li
      ref={wrapperRef}
      className="relative shrink-0"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          NAV_LINK,
          'gap-[7px]',
          active || open
            ? 'bg-[var(--lw-primary)] text-white'
            : overlay
              ? 'text-[var(--color-text-inverse)] hover:bg-[var(--lw-accent)] hover:text-white'
              : 'text-[var(--lw-accent)] hover:bg-[var(--lw-primary)] hover:text-white'
        )}
      >
        {item.label}
        <ChevronIcon className={cn('transition-transform duration-quick', open && 'rotate-180')} />
      </button>
      {panel}
    </li>
  );
}

/**
 * Compact single-column dropdown (e.g. header "Resources") — same open/
 * close/keyboard/outside-click behavior as the Services mega menu, but a
 * plain flat list instead of a multi-column panel with group headings,
 * since a short flat list doesn't need that structure.
 */
function FlatDropdownItem({
  label,
  links,
  pathname,
  overlay,
}: {
  label: string;
  links: NavLink[];
  pathname: string;
  overlay?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(110);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const active = links.some((link) => isActive(pathname, link.href));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const header = document.querySelector('header')?.getBoundingClientRect();
      const fromTrigger = trigger ? trigger.bottom + 12 : 0;
      const fromHeader = (header?.bottom ?? 110) + 16;
      setTop(Math.max(fromTrigger, fromHeader));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.resources-dropdown')) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const openNow = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  const panel =
    mounted &&
    open &&
    createPortal(
      <div
        id={panelId}
        className="resources-dropdown fixed left-1/2 z-[70] w-[min(220px,calc(100vw-2rem))] -translate-x-1/2"
        style={{ top }}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
      >
        <ul className="flex flex-col gap-0.5 rounded-[18px] border border-black/5 bg-white p-2.5 shadow-[0_16px_40px_rgba(20,40,60,0.14)]">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                prefetch
                aria-current={pathname === link.href ? 'page' : undefined}
                className={cn(
                  'block rounded-[10px] px-3.5 py-2.5 text-[15px] font-normal leading-[1.4] no-underline transition-colors duration-300',
                  pathname === link.href
                    ? 'bg-[var(--lw-primary)] text-white'
                    : 'text-[var(--lw-accent)] hover:bg-[var(--lw-primary)] hover:text-white'
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>,
      document.body
    );

  return (
    <li
      ref={wrapperRef}
      className="relative shrink-0"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          NAV_LINK,
          'gap-[7px]',
          active || open
            ? 'bg-[var(--lw-primary)] text-white'
            : overlay
              ? 'text-[var(--color-text-inverse)] hover:bg-[var(--lw-accent)] hover:text-white'
              : 'text-[var(--lw-accent)] hover:bg-[var(--lw-primary)] hover:text-white'
        )}
      >
        {label}
        <ChevronIcon className={cn('transition-transform duration-quick', open && 'rotate-180')} />
      </button>
      {panel}
    </li>
  );
}

/* -------------------------------------------------------------- icons --- */

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m3 6 5 5 5-5" />
    </svg>
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
