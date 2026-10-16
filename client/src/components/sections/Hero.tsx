import { hero } from '@/data/marketing';
import { site } from '@/data/site';
import type { ResolvedHero, BookingProfiles } from '@/lib/cms-resolve';
import { HeroMedia } from './HeroMedia';
import { OutlineButton, SwapButton } from '@/components/ui/SwapButton';
import { Reveal } from '@/components/ui/Reveal';
import Link from 'next/link';

/**
 * Homepage hero. Phase 23 premium redesign: non-italic Lora heading (the
 * original site's italic treatment read as more decorative/ornate than the
 * calm, modern brief calls for), a brand-blue-tinted dark overlay instead of
 * pure black (warmer, stays in-palette, same contrast guarantee — see
 * HeroMedia for the image itself, unchanged), and a subtle fade/rise-in on
 * first paint (Reveal — respects prefers-reduced-motion via globals.css's
 * sitewide catch-all). Content, data flow, and all hrefs are unchanged from
 * before this phase — Inter now renders the body copy via --font-body.
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

      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-[#162634]/82 via-[#1c3345]/56 to-[#1c3345]/16"
      />

      <div className="relative w-full px-4 pb-14 pt-[calc(88px+env(safe-area-inset-top))] sm:max-[1601px]:px-[30px] sm:max-[1601px]:pb-20 sm:max-[1601px]:pt-[calc(120px+env(safe-area-inset-top))] lg:max-[1601px]:px-[70px] lg:max-[1601px]:py-[100px] min-[1601px]:px-10 min-[1601px]:pb-[100px] min-[1601px]:pt-[200px]">
        <Reveal className="w-full max-w-[420px] md:w-1/2 md:max-desktop:max-w-none desktop:max-w-[760px]">
          <h1
            id="hero-heading"
            className="font-heading text-[30px] font-normal leading-[1.15] tracking-normal [text-wrap:wrap] md:max-desktop:text-[42px] desktop:text-[46px]"
          >
            <span className="text-[var(--color-brand-primary-on-dark)]">{primary}{accent ? ' ' : ''}</span>
            {accent ? <span className="text-[var(--color-brand-accent-on-dark)]">{accent}</span> : null}
          </h1>

          <p className="mt-6 text-[14px] font-normal leading-[1.55] text-white sm:max-desktop:text-[16px] desktop:text-[18px]">
            {data.subheading}
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-4 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <SwapButton href={bookHref} trackAs="booking_click">{bookLabel}</SwapButton>
            <OutlineButton href="/fees-insurance">Insurance &amp; Pricing</OutlineButton>
            <Link
              href="/our-services"
              className="inline-flex min-h-[44px] items-center justify-center px-2 text-[15px] font-semibold text-white underline decoration-white/60 underline-offset-4 transition-colors hover:text-white sm:min-h-[51px] sm:text-[16px]"
            >
              Explore Services
            </Link>
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

          <p className="mt-8 inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-2 text-[12px] font-medium leading-[1.45] text-white backdrop-blur-sm sm:mt-10 sm:max-desktop:text-[13px] desktop:text-[14px]">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--color-brand-accent-on-dark)]" />
            {data.badge}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
