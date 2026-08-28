import { hero } from '@/data/marketing';
import { site } from '@/data/site';
import type { ResolvedHero, BookingProfiles } from '@/lib/cms-resolve';
import { HeroMedia } from './HeroMedia';
import { OutlineButton, SwapButton } from '@/components/ui/SwapButton';
import Link from 'next/link';

/**
 * Homepage hero — tokens from the live Elementor kit:
 * Lora 400 italic 60px / 1.05, primary #3E7FB1 + secondary #5FAF6B,
 * Source Sans 18px body, swap-button hover to green, outline hover to blue.
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
  const primary = data.headingPrimary || data.heading;
  const accent = data.headingAccent || '';
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
      className="relative isolate flex min-h-[100svh] max-h-none items-center overflow-hidden md:min-h-[850px] min-[1181px]:min-h-[950px]"
    >
      <HeroMedia image={data.image} />

      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/50" />

      <div className="relative w-full px-4 pb-14 pt-[calc(88px+env(safe-area-inset-top))] sm:px-[30px] sm:pb-20 sm:pt-[calc(120px+env(safe-area-inset-top))] lg:px-[70px] lg:py-[100px] min-[1601px]:px-10 min-[1601px]:pb-[100px] min-[1601px]:pt-[200px]">
        <div className="w-full max-w-[670px] md:w-1/2 md:max-w-none min-[1181px]:max-w-[670px]">
          <h1
            id="hero-heading"
            className="font-heading text-[35px] font-normal italic leading-[1.05] tracking-normal [text-wrap:wrap] md:text-[50px] min-[1181px]:text-[60px]"
          >
            <span className="text-[var(--lw-primary)]">{primary}{accent ? ' ' : ''}</span>
            {accent ? <span className="text-[var(--lw-accent)]">{accent}</span> : null}
          </h1>

          <p className="mt-6 text-[14px] font-normal leading-[1.45] text-white sm:text-[16px] min-[1181px]:text-[18px]">
            {data.subheading}
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-4 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <SwapButton href={bookHref}>{bookLabel}</SwapButton>
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

          <p className="mt-8 text-[12px] font-light leading-[1.45] text-white sm:mt-10 sm:text-[14px] min-[1181px]:text-[16px]">
            {data.badge}
          </p>
        </div>
      </div>
    </section>
  );
}
