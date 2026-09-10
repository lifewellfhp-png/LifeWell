'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem, NavLink } from '@/types/content';
import { cn } from '@/lib/utils';
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
