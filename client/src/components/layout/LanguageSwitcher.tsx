'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const COOKIE_NAME = 'NEXT_LOCALE';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Spanish pages live at the same slug as their English equivalent, under
 * an /es prefix (e.g. /our-services <-> /es/our-services) — this is the
 * one assumption this whole switcher depends on; see the Part 3 routing
 * decision in the project's plan for why. */
function otherLocaleHref(pathname: string, currentLocale: 'en' | 'es'): string {
  if (currentLocale === 'en') {
    return pathname === '/' ? '/es' : `/es${pathname}`;
  }
  const stripped = pathname.replace(/^\/es/, '');
  return stripped === '' ? '/' : stripped;
}

function remember(locale: 'en' | 'es') {
  try {
    document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  } catch {
    // Cookie storage can throw in a private window — remembering the
    // choice is a nicety, never required for the switch link itself to work.
  }
}

/**
 * "EN | ES" header switcher. Keyboard accessible (real <Link>s, not a
 * div-with-onClick) — the current language is a non-interactive, visually
 * distinct label (not a link to itself), the other language is a real
 * link to the equivalent page in that language.
 *
 * Does NOT auto-redirect anyone based on the remembered cookie — see the
 * project's plan for why: English must stay at its current URLs by
 * default, and auto-redirecting "/" based on a stray cookie risks that
 * and could do something unexpected to a crawler. The cookie is set for
 * a future enhancement to read, not acted on anywhere today.
 */
function LocaleLabel({
  label,
  isCurrent,
  otherHref,
  onSwitch,
  overlay,
}: {
  label: string;
  isCurrent: boolean;
  otherHref: string;
  onSwitch: () => void;
  overlay: boolean;
}) {
  if (isCurrent) {
    return (
      <span
        aria-current="true"
        className={cn('px-1.5 py-1', overlay ? 'text-white' : 'text-[var(--lw-primary)]')}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={otherHref}
      onClick={onSwitch}
      className={cn(
        'rounded px-1.5 py-1 no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        overlay ? 'text-white/80 focus-visible:outline-white' : 'text-text-secondary'
      )}
    >
      {label}
    </Link>
  );
}

export function LanguageSwitcher({
  currentLocale,
  overlay = false,
}: {
  currentLocale: 'en' | 'es';
  /** True when rendered over a transparent/photo hero (the English
   * header's un-scrolled homepage state) — switches to light text so it
   * stays legible against a photo instead of brand-navy-on-navy. */
  overlay?: boolean;
}) {
  const pathname = usePathname() || '/';
  const otherLocale = currentLocale === 'en' ? 'es' : 'en';
  const otherHref = otherLocaleHref(pathname, currentLocale);

  return (
    <nav aria-label="Language" className="flex items-center gap-1 text-[13px] font-semibold">
      <LocaleLabel
        label="EN"
        isCurrent={currentLocale === 'en'}
        otherHref={otherHref}
        onSwitch={() => remember(otherLocale)}
        overlay={overlay}
      />
      <span aria-hidden="true" className={overlay ? 'text-white/60' : 'text-text-secondary'}>
        |
      </span>
      <LocaleLabel
        label="ES"
        isCurrent={currentLocale === 'es'}
        otherHref={otherHref}
        onSwitch={() => remember(otherLocale)}
        overlay={overlay}
      />
    </nav>
  );
}
