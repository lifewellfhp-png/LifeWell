'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem, NavLink } from '@/types/content';
import { cn } from '@/lib/utils';
import { trackConversion } from '@/lib/cms';
import { LongArrow } from '@/components/ui/SwapButton';
import { preceptorshipLink } from '@/data/navigation';
import { MENTAL_HEALTH_ICONS } from './navMenuIcons';
import { HeaderCta } from './HeaderCta';
import { MobileMenu } from './MobileMenu';

/**
 * Compact ↔ full desktop navigation switches on Tailwind's built-in `xl`
 * breakpoint (1280px) — a plain CSS media query, not a client-side
 * ResizeObserver measurement (Phase 20/21 used one; both phases found it
 * genuinely unstable — a few px of margin that varied across page loads
 * from component-order/hydration timing, not a deterministic function of
 * viewport). A fixed breakpoint has none of that: it's correct on first
 * paint (no hydration flash, no JS needed before the right state renders),
 * can't oscillate, and needs no measurement machinery to maintain.
 *
 * This is only safe because Phase 22 also removed the redundant "Home" nav
 * entry (data/navigation.ts — the logo already serves as home) and gave the
 * header its own, wider container (--container-header in globals.css,
 * decoupled from the sitewide --container-page) — verified by direct
 * measurement to leave a comfortable, non-razor-thin margin at 1280px and
 * every wider breakpoint up to 3840px; see the Phase 22 report. `xl` is a
 * built-in Tailwind breakpoint, not a custom one, so it can't hit the
 * Tailwind v4 custom-breakpoint cascade-order issue fixed in Phases 18-19.
 */
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

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-5">
      <nav aria-label="Main" className="hidden min-w-0 flex-1 overflow-x-clip xl:flex">
        <ul className="flex w-full items-center justify-center gap-[3px]">
          {items.map((item) =>
            item.groups ? (
              <MegaMenuItem key={item.href} item={item} pathname={pathname} overlay={overlay} cta={cta} />
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

      {/* max-xl:ml-auto: below xl, <nav> above is display:none and
          contributes no flex-grow to push this group right, so it needs its
          own margin; at xl+ <nav>'s flex-1 already does that job. */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3 max-xl:ml-auto">
        <div className="hidden xl:flex">
          <HeaderCta href={cta.href} overlay={overlay} trackAs="booking_click">
            {cta.label}
          </HeaderCta>
        </div>

        <div className="hidden sm:flex xl:hidden">
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
            // drawer it opens. Search must stay reachable even once the
            // real nav links are shown at xl+ (Phase 20 finding).
            'relative z-10 inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-sm border px-3 text-sm font-semibold transition-colors duration-quick sm:px-4',
            overlay
              ? 'border-white/50 text-white hover:bg-white/10'
              : 'border-border-subtle text-text-primary hover:bg-surface-muted'
          )}
        >
          <BurgerIcon />
          {/* Text label only below xl — at xl+ this control exists purely to
              reach search (the real nav links are already visible), so the
              label isn't earning its keep against the header's width
              budget. aria-label above carries the accessible name either
              way. */}
          <span className="hidden sm:inline xl:hidden">Menu</span>
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
 * Services mega menu — two fixed, top-aligned columns (Mental Health /
 * Primary Care) plus a bottom strip (Preceptorship link, "View all
 * services", Book an Appointment).
 *
 * Opens on hover for pointer users, and on click/Enter/Space (native
 * <button> activation) for everyone; Escape closes and returns focus to
 * the trigger; clicking outside closes it; opening moves focus to the
 * panel's first link.
 */
function MegaMenuItem({
  item,
  pathname,
  overlay,
  cta,
}: {
  item: NavItem;
  pathname: string;
  overlay?: boolean;
  cta: NavLink;
}) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(110);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  // Moves focus into the panel once it exists in the DOM (a tick after
  // `open` flips true, since the portal hasn't mounted yet in the same
  // render). Covers both the click/Enter/Space trigger path and the hover
  // path — "focus moves into the menu" applies whichever opened it.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.services-mega')) return;
      // A focus-driven close (Tab/Escape) returns focus to the trigger; a
      // mouse click outside the menu is already moving focus/attention
      // somewhere else on its own, so it isn't redirected back here.
      close(false);
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

  const onBookClick = () =>
    void trackConversion('booking_click', typeof window !== 'undefined' ? window.location.pathname : undefined);

  const panel =
    mounted &&
    open &&
    createPortal(
      <div
        id={panelId}
        ref={panelRef}
        role="menu"
        aria-label={item.label}
        className="services-mega fixed left-1/2 z-[70] w-[min(900px,calc(100vw-2rem))] -translate-x-1/2"
        style={{ top }}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
      >
        <div className="overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_16px_40px_rgba(20,40,60,0.14)]">
          <div className="flex flex-col divide-y divide-[#EEF2FA] sm:flex-row sm:divide-x sm:divide-y-0">
            {item.groups?.map((group) => {
              const isMentalHealth = group.label === 'Mental Health';
              return (
                <div key={group.label} className="flex min-w-0 flex-1 flex-col items-start gap-3 p-5 sm:p-6">
                  <span className="relative pb-2 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--lw-primary)] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-6 after:bg-[var(--lw-accent)]">
                    {group.label}
                  </span>
                  <ul className="flex w-full flex-col">
                    {group.links.map((link, i) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          prefetch
                          aria-current={pathname === link.href ? 'page' : undefined}
                          className="group/link flex items-start gap-2.5 rounded-[10px] px-2.5 py-2 no-underline transition-colors duration-200 hover:bg-[#EEF2FA]"
                        >
                          {isMentalHealth && (
                            <span className="mt-0.5 shrink-0 text-[var(--lw-accent)]">
                              {MENTAL_HEALTH_ICONS[i]?.()}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block text-[16px] font-semibold leading-snug text-[var(--lw-primary)] transition-colors duration-200 group-hover/link:text-[var(--lw-accent)]">
                              {link.label}
                            </span>
                            {link.description && (
                              <span className="mt-0.5 block text-[14px] leading-snug text-[#6B7280]">
                                {link.description}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-start gap-3 border-t border-[#EEF2FA] bg-[#F7FAFC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Link
              href={preceptorshipLink.href}
              prefetch
              className="text-[14px] font-semibold text-[var(--lw-primary)] no-underline hover:text-[var(--lw-accent)]"
            >
              For nursing students: {preceptorshipLink.label} <span aria-hidden="true">→</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/our-services"
                prefetch
                className="text-[14px] font-semibold text-[var(--lw-primary)] no-underline hover:text-[var(--lw-accent)]"
              >
                View all services <span aria-hidden="true">→</span>
              </Link>
              <Link
                href={cta.href}
                prefetch
                onClick={onBookClick}
                className="inline-flex min-h-[38px] items-center justify-center gap-2 whitespace-nowrap rounded-[30px] bg-[var(--lw-accent)] px-4 text-[13px] font-semibold leading-none text-white no-underline transition-colors duration-300 hover:bg-[var(--color-brand-accent-hover)]"
              >
                {cta.label}
                <LongArrow />
              </Link>
            </div>
          </div>
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
        // Always opens — never toggles. A real mouse click fires
        // mouseenter (opening via onMouseEnter below) immediately before
        // the click event; a toggle here would then close what hover just
        // opened, so every pointer click appeared to do nothing. Matches
        // this component's own "opens on hover... and on click" docstring:
        // closing is onMouseLeave, outside-click, or Escape's job, not
        // click's. (Phase 22 finding — pre-existing, not introduced by
        // that phase, but only now exercised: desktop nav was in permanent
        // compact mode through Phases 20-21, so this trigger was never
        // reachable by a real pointer click in that window.)
        onClick={() => setOpen(true)}
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
  const panelRef = useRef<HTMLDivElement>(null);
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

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  // Same "focus moves into the menu" behavior as the Services mega menu.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.resources-dropdown')) return;
      close(false);
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
        ref={panelRef}
        role="menu"
        aria-label={label}
        className="resources-dropdown fixed left-1/2 z-[70] w-[min(240px,calc(100vw-2rem))] -translate-x-1/2"
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
                  'block rounded-[10px] px-3.5 py-2.5 text-[16px] font-semibold leading-[1.4] no-underline transition-colors duration-200',
                  pathname === link.href
                    ? 'bg-[#EEF2FA] text-[var(--lw-accent)]'
                    : 'text-[var(--lw-primary)] hover:bg-[#EEF2FA] hover:text-[var(--lw-accent)]'
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
        // Always opens — never toggles. A real mouse click fires
        // mouseenter (opening via onMouseEnter below) immediately before
        // the click event; a toggle here would then close what hover just
        // opened, so every pointer click appeared to do nothing. Matches
        // this component's own "opens on hover... and on click" docstring:
        // closing is onMouseLeave, outside-click, or Escape's job, not
        // click's. (Phase 22 finding — pre-existing, not introduced by
        // that phase, but only now exercised: desktop nav was in permanent
        // compact mode through Phases 20-21, so this trigger was never
        // reachable by a real pointer click in that window.)
        onClick={() => setOpen(true)}
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
