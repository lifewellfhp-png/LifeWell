import { Container, Section } from '@/components/ui/Section';
import { LongArrow, SwapButton } from '@/components/ui/SwapButton';
import type { BookingProfiles } from '@/lib/cms-resolve';

/**
 * Premium booking-page choice cards. No official Zocdoc / Psychology Today
 * logo file is embedded here — this workspace has no verified, licensed copy
 * of either brand's mark, and approximating one would risk trademark misuse.
 * PlatformWordmark is a plain LifeWell-styled text label instead (nominative
 * use of the platform's name, not a reproduction of its logo). Swap in an
 * official asset via Media once the owner supplies one under their brand
 * usage terms.
 */

const externalLinkProps = {
  target: '_blank' as const,
  rel: 'noopener noreferrer' as const,
};

function PlatformWordmark({ name }: { name: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-[8px] bg-[#EEF3F7] px-3.5 py-1.5 text-[13px] font-bold tracking-tight text-[var(--lw-primary)]">
      {name}
    </span>
  );
}

/** Centered "Book an Appointment" page header. */
export function BookingPageHeader({ profiles }: { profiles: BookingProfiles }) {
  return (
    <Section tone="transparent" spacing="sm">
      <Container size="narrow">
        <div className="text-center">
          <h1 className="font-heading text-[32px] font-normal leading-[1.15] tracking-[-2px] text-[var(--lw-primary)] sm:text-[48px] min-[1181px]:text-[56px]">
            {profiles.pageCopy.heading}
          </h1>
          <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
            {profiles.pageCopy.subtitle}
          </p>
        </div>
      </Container>
    </Section>
  );
}

/** Two-column primary choice: LifeWell direct booking (always) + Zocdoc (if configured). */
export function BookingChoiceGrid({
  profiles,
  calendarAnchor = '#charm-calendar',
}: {
  profiles: BookingProfiles;
  calendarAnchor?: string;
}) {
  const zocdocUrl = profiles.display.bookingPage && profiles.zocdoc.enabled ? profiles.zocdoc.bookingUrl : null;

  const cardClass =
    'flex flex-col rounded-[24px] border border-[#e1e8ee] bg-white p-8 shadow-[0_10px_28px_rgba(62,127,177,0.08)] sm:p-10';

  return (
    <Section tone="transparent" spacing="sm" aria-labelledby="booking-choice-heading">
      <Container>
        <h2 id="booking-choice-heading" className="sr-only">
          Ways to book an appointment
        </h2>
        <div className={zocdocUrl ? 'grid gap-6 lg:grid-cols-2 lg:gap-8' : 'mx-auto max-w-[560px]'}>
          <div className={cardClass}>
            <span className="inline-flex w-fit rounded-[7px] bg-[var(--lw-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-white">
              Recommended
            </span>
            <h3 className="mt-5 font-heading text-[24px] font-normal leading-[1.2] text-[var(--lw-primary)] sm:text-[28px]">
              {profiles.pageCopy.directHeading}
            </h3>
            <p className="mt-3 flex-1 text-[15px] leading-[1.45] text-[#374151] sm:text-[16px]">
              {profiles.pageCopy.directDescription}
            </p>
            <div className="mt-6">
              <SwapButton href={calendarAnchor} fullWidth>
                Choose a Time
              </SwapButton>
            </div>
          </div>

          {zocdocUrl && (
            <div className={cardClass}>
              <PlatformWordmark name="Zocdoc" />
              <h3 className="mt-5 font-heading text-[24px] font-normal leading-[1.2] text-[var(--lw-primary)] sm:text-[28px]">
                Book through Zocdoc
              </h3>
              <p className="mt-3 flex-1 text-[15px] leading-[1.45] text-[#374151] sm:text-[16px]">
                {profiles.zocdoc.description || 'Use Zocdoc to view available appointment options.'}
              </p>
              <div className="mt-6">
                <a
                  href={zocdocUrl}
                  {...externalLinkProps}
                  className="inline-flex min-h-[51px] w-full items-center justify-center gap-2 rounded-[30px] border border-[var(--lw-primary)] px-[26px] py-[14px] text-[16px] font-semibold text-[var(--lw-primary)] no-underline transition-colors duration-300 hover:bg-[var(--lw-primary)] hover:text-white"
                >
                  {profiles.zocdoc.ctaLabel}
                  <LongArrow />
                </a>
              </div>
              <p className="mt-3 text-center text-[12px] text-[#9ca3af]">
                You&apos;ll leave LifeWell&apos;s website to continue on Zocdoc.
              </p>
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}

/** Zocdoc Reviews + Psychology Today trust cards. */
export function TrustedPlatformsSection({ profiles }: { profiles: BookingProfiles }) {
  const zocdocUrl = profiles.display.bookingPage && profiles.zocdoc.enabled ? profiles.zocdoc.profileUrl || profiles.zocdoc.bookingUrl : null;
  const ptUrl = profiles.display.bookingPage && profiles.psychologyToday.enabled ? profiles.psychologyToday.profileUrl || profiles.psychologyToday.contactUrl : null;
  const rating = profiles.zocdoc.ratingEnabled ? profiles.zocdoc.rating : null;
  const reviewCount = profiles.zocdoc.ratingEnabled ? profiles.zocdoc.reviewCount : null;
  const showRatingNumbers = rating !== null && reviewCount !== null;

  if (!zocdocUrl && !ptUrl) return null;

  const cardClass = 'rounded-[20px] border border-[#e1e8ee] bg-white p-7 text-center sm:p-8';

  return (
    <Section tone="muted" aria-labelledby="trusted-platforms-heading">
      <Container>
        <h2
          id="trusted-platforms-heading"
          className="text-center font-heading text-[24px] font-normal leading-[1.2] text-[var(--lw-primary)] sm:text-[30px]"
        >
          {profiles.pageCopy.trustHeading}
        </h2>

        <div className={ptUrl && zocdocUrl ? 'mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8' : 'mt-10 mx-auto max-w-[420px]'}>
          {zocdocUrl && (
            <div className={cardClass}>
              <div className="flex justify-center">
                <PlatformWordmark name="Zocdoc" />
              </div>
              <h3 className="mt-4 font-heading text-[20px] font-normal text-[var(--lw-primary)]">Zocdoc Reviews</h3>
              {showRatingNumbers && rating !== null && reviewCount !== null ? (
                <p className="mt-2 text-[17px] font-semibold text-[#374151]">
                  {rating.toFixed(1)} ★ out of 5
                  <span className="mt-1 block text-[13px] font-normal text-[#6b7280]">
                    {reviewCount} review{reviewCount === 1 ? '' : 's'}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-[15px] text-[#374151]">Read our reviews on Zocdoc</p>
              )}
              <div className="mt-5">
                <a
                  href={zocdocUrl}
                  {...externalLinkProps}
                  className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline"
                >
                  Read Reviews on Zocdoc
                  <LongArrow />
                </a>
              </div>
            </div>
          )}

          {ptUrl && (
            <div className={cardClass}>
              <div className="flex justify-center">
                <PlatformWordmark name="Psychology Today" />
              </div>
              <h3 className="mt-4 font-heading text-[20px] font-normal text-[var(--lw-primary)]">Psychology Today</h3>
              <p className="mt-2 text-[15px] text-[#374151]">
                {profiles.psychologyToday.description || 'View our professional profile on Psychology Today.'}
              </p>
              <div className="mt-5">
                <a
                  href={ptUrl}
                  {...externalLinkProps}
                  className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--lw-accent)] underline-offset-4 hover:underline"
                >
                  {profiles.psychologyToday.ctaLabel}
                  <LongArrow />
                </a>
              </div>
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
