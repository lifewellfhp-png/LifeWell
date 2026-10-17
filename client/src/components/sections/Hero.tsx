import { hero } from '@/data/marketing';
import { site } from '@/data/site';
import type { ResolvedHero, BookingProfiles } from '@/lib/cms-resolve';
import { HeroMedia } from './HeroMedia';
import { OutlineButton } from '@/components/ui/SwapButton';
import { HeroBookButton } from './HeroBookButton';

/**
 * Homepage hero. Phase 24 homepage reorg: navy overlay on the left side
 * only (fades to fully transparent by 75% width, so the photo stays
 * natural and clear on the right — not a wash across the whole image);
 * exactly two actions (Book + Insurance & Pricing) — the old third
 * "Explore Services" text link is gone; the trust badge is now a small
 * pill. Copy/content/data flow are unchanged.
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
      className="relative isolate flex min-h-[100svh] max-h-none items-center overflow-hidden md:max-desktop:min-h-[850px] desktop:min-h-[950px]"
    >
      <HeroMedia image={data.image} hasCmsImage={data.hasCmsImage} />

      {/*
        Navy overlay, left side only (Phase 24) — fully transparent by 75%
        width, so the right side of the photo stays natural and clear
        instead of a wash across the whole image. pointer-events-none and
        -z-10 (same stacking context as HeroMedia, behind the content div
        below) so it can never sit on top of the header, buttons, or chat
        button — those are all separate elements outside this section.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(90deg, rgba(0,37,116,0.85) 0%, rgba(0,37,116,0.6) 45%, rgba(0,37,116,0) 75%)',
        }}
      />

      <div className="relative w-full px-4 pb-14 pt-[calc(88px+env(safe-area-inset-top))] sm:max-[1601px]:px-[30px] sm:max-[1601px]:pb-20 sm:max-[1601px]:pt-[calc(120px+env(safe-area-inset-top))] lg:max-[1601px]:px-[70px] lg:max-[1601px]:py-[100px] min-[1601px]:px-10 min-[1601px]:pb-[100px] min-[1601px]:pt-[200px]">
        <div className="w-full max-w-[420px] md:w-1/2 md:max-desktop:max-w-none desktop:max-w-[760px]">
          {/* All white (Phase 24) — no two-tone color split. */}
          <h1
            id="hero-heading"
            className="font-heading text-[30px] font-normal italic leading-[1.2] tracking-normal text-white [text-wrap:wrap] md:max-desktop:text-[42px] desktop:text-[46px]"
          >
            {primary}{accent ? ` ${accent}` : ''}
          </h1>

          <p className="mt-6 text-[14px] font-normal leading-[1.45] text-white sm:max-desktop:text-[16px] desktop:text-[18px]">
            {data.subheading}
          </p>

          {/*
            Phase 24: exactly two actions. Book is a single integrated
            pill with the arrow inside it (not the site-wide SwapButton's
            pill + detached circular chip) — solid green, no opacity. The
            old third "Explore Services" text link is gone.
          */}
          <div className="mt-8 flex flex-col items-stretch gap-4 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <HeroBookButton href={bookHref} label={bookLabel} />
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
