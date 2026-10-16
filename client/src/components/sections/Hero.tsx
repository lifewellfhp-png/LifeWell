import { hero } from '@/data/marketing';
import { site } from '@/data/site';
import type { ResolvedHero, BookingProfiles } from '@/lib/cms-resolve';
import { HeroMedia } from './HeroMedia';
import { OutlineButton, SwapButton } from '@/components/ui/SwapButton';

/**
 * Homepage hero. Phase 24 homepage reorg: navy-tinted overlay (matches the
 * new logo-derived brand navy, --lw-primary) replacing the old pure-black
 * gradient; exactly two actions (Book + Insurance & Pricing) — the old
 * third "Explore Services" text link is gone; the trust badge is now a
 * small pill. Copy/content/data flow are unchanged.
 */
export function Hero({
  hero: heroProp,
  bookingUrl,
  bookingLabel,
  bookingProfiles,
}: {
  hero?: ResolvedHero;
  bookingUrl?: string;
  bookingLabel?: string;
  bookingProfiles?: BookingProfiles;
} = {}) {
  const data: ResolvedHero = heroProp ?? { ...hero };
  const rawPrimary = data.headingPrimary || data.heading;
  const rawAccent = data.headingAccent || '';

  // When the CMS provides one combined heading (no separately authored
  // accent field), automatically color the clause after an em dash as the
  // accent phrase — the established two-tone hero-heading treatment this
  // component already supports for explicitly split CMS fields, applied
  // here to a single sentence with a natural "— " break instead.
  const dashIndex = !rawAccent ? rawPrimary.indexOf('—') : -1;
  const primary = dashIndex > -1 ? rawPrimary.slice(0, dashIndex).trim() : rawPrimary;
  const accent = dashIndex > -1 ? rawPrimary.slice(dashIndex).trim() : rawAccent;
  const bookHref = bookingUrl ?? site.booking.page;
  const bookLabel = bookingLabel ?? site.booking.label;
  const zocdocUrl =
    bookingProfiles?.display.homepage && bookingProfiles.zocdoc.enabled
      ? bookingProfiles.zocdoc.bookingUrl
      : null;
  const zocdocLabel = bookingProfiles?.zocdoc.ctaLabel ?? '';

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[calc(100svh-var(--crisis-bar-height))] max-h-none items-center overflow-hidden md:max-desktop:min-h-[calc(850px-var(--crisis-bar-height))] desktop:min-h-[calc(950px-var(--crisis-bar-height))]"
    >
      <HeroMedia image={data.image} hasCmsImage={data.hasCmsImage} />

      {/* Navy-tinted overlay (Phase 24) — was a pure-black gradient. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--lw-primary)]/85 via-[var(--lw-primary)]/60 to-[var(--lw-primary)]/20"
      />

      <div className="relative w-full px-4 pb-14 pt-[calc(88px+env(safe-area-inset-top))] sm:max-[1601px]:px-[30px] sm:max-[1601px]:pb-20 sm:max-[1601px]:pt-[calc(120px+env(safe-area-inset-top))] lg:max-[1601px]:px-[70px] lg:max-[1601px]:py-[100px] min-[1601px]:px-10 min-[1601px]:pb-[100px] min-[1601px]:pt-[200px]">
        <div className="w-full max-w-[420px] md:w-1/2 md:max-desktop:max-w-none desktop:max-w-[760px]">
          <h1
            id="hero-heading"
            className="font-heading text-[30px] font-normal italic leading-[1.2] tracking-normal [text-wrap:wrap] md:max-desktop:text-[42px] desktop:text-[46px]"
          >
            <span className="text-[var(--color-brand-primary-on-dark)]">{primary}{accent ? ' ' : ''}</span>
            {accent ? <span className="text-[var(--color-brand-accent-on-dark)]">{accent}</span> : null}
          </h1>

          <p className="mt-6 text-[14px] font-normal leading-[1.45] text-white sm:max-desktop:text-[16px] desktop:text-[18px]">
            {data.subheading}
          </p>

          {/* Phase 24: exactly two actions — Book (green) + Insurance & Pricing (white outline). The old third "Explore Services" text link is gone. */}
          <div className="mt-8 flex flex-col items-stretch gap-4 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <SwapButton href={bookHref} tone="accent" trackAs="booking_click">{bookLabel}</SwapButton>
            <OutlineButton href="/fees-insurance">Insurance &amp; Pricing</OutlineButton>
          </div>

          {zocdocUrl && (
            <p className="mt-4 text-[13px] font-light leading-[1.45] text-white/80 sm:text-[14px]">
              Prefer another way to book?{' '}
              <a
                href={zocdocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                {zocdocLabel}
              </a>
            </p>
          )}

          {/* Small "Now accepting new patients" badge (Phase 24). */}
          <p className="mt-8 inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-2 text-[12px] font-medium leading-[1.45] text-white backdrop-blur-sm sm:mt-10 sm:max-desktop:text-[13px] desktop:text-[14px]">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--lw-accent)]" />
            {data.badge}
          </p>
        </div>
      </div>
    </section>
  );
}
