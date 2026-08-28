import { Container } from '@/components/ui/Section';
import { LongArrow } from '@/components/ui/SwapButton';
import type { BookingProfiles } from '@/lib/cms-resolve';

/**
 * Zocdoc / Psychology Today are secondary trust & booking channels — never a
 * replacement for LifeWell's own CharmHealth booking flow. Every block here
 * renders nothing unless the owner has explicitly enabled it in Admin, and
 * a rating/review count only ever appears when the owner has entered real,
 * verified values (see mapBookingProfiles in cms-resolve.ts).
 */

const externalLinkProps = {
  target: '_blank' as const,
  rel: 'noopener noreferrer' as const,
};

/** Bio page: tasteful, text-only professional-profile trust links. */
export function ProviderTrustLinks({ profiles }: { profiles: BookingProfiles }) {
  const { zocdoc, psychologyToday, display } = profiles;
  const zocdocUrl = display.bioPage && zocdoc.enabled ? zocdoc.profileUrl || zocdoc.bookingUrl : null;
  const ptUrl = display.bioPage && psychologyToday.enabled ? psychologyToday.profileUrl || psychologyToday.contactUrl : null;

  if (!zocdocUrl && !ptUrl) return null;

  return (
    <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 lg:justify-start">
      {zocdocUrl && (
        <li>
          <a
            href={zocdocUrl}
            {...externalLinkProps}
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--lw-accent)] underline-offset-4 hover:underline"
          >
            View my Zocdoc profile
            <LongArrow />
          </a>
        </li>
      )}
      {ptUrl && (
        <li>
          <a
            href={ptUrl}
            {...externalLinkProps}
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--lw-accent)] underline-offset-4 hover:underline"
          >
            Find me on Psychology Today
            <LongArrow />
          </a>
        </li>
      )}
    </ul>
  );
}

/** Reviews page: a distinctly-attributed trust block, kept visually separate from LifeWell's own testimonials. */
export function PatientTrustSection({ profiles }: { profiles: BookingProfiles }) {
  const { zocdoc, psychologyToday, display } = profiles;
  const zocdocUrl = display.reviewsPage && zocdoc.enabled ? zocdoc.profileUrl || zocdoc.bookingUrl : null;
  const ptUrl = display.reviewsPage && psychologyToday.enabled ? psychologyToday.profileUrl || psychologyToday.contactUrl : null;
  const rating = zocdoc.ratingEnabled ? zocdoc.rating : null;
  const reviewCount = zocdoc.ratingEnabled ? zocdoc.reviewCount : null;
  const showRatingNumbers = rating !== null && reviewCount !== null;

  if (!zocdocUrl && !ptUrl) return null;

  return (
    <section
      aria-labelledby="patient-trust-heading"
      className="bg-[#EEF3F7] py-16 sm:py-20 lg:py-24"
    >
      <Container>
        <div className="mx-auto max-w-[40rem] text-center">
          <p className="mx-auto w-fit rounded-[7px] bg-white px-4 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:text-[12px]">
            Patient Experiences
          </p>
          <h2
            id="patient-trust-heading"
            className="mt-5 font-heading text-[26px] font-normal leading-[1.15] tracking-[-1px] text-[var(--lw-primary)] sm:text-[34px]"
          >
            Verified on Zocdoc
          </h2>

          {zocdocUrl && (
            <div className="mt-6">
              {showRatingNumbers && rating !== null && reviewCount !== null ? (
                <p className="text-[20px] font-semibold text-[#374151] sm:text-[22px]">
                  {rating.toFixed(1)} ★ on Zocdoc
                  <span className="mt-1 block text-[14px] font-normal text-[#6b7280]">
                    Based on {reviewCount} review{reviewCount === 1 ? '' : 's'}
                  </span>
                </p>
              ) : (
                <p className="text-[16px] text-[#374151]">Read our reviews on Zocdoc</p>
              )}
              {zocdoc.ratingVerifiedAt && (
                <p className="mt-2 text-[12px] text-[#9ca3af]">
                  Rating last verified {zocdoc.ratingVerifiedAt}
                </p>
              )}
              <div className="mt-5">
                <a
                  href={zocdocUrl}
                  {...externalLinkProps}
                  className="inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline"
                >
                  Read patient reviews on Zocdoc
                  <LongArrow />
                </a>
              </div>
              <p className="mt-4 text-[12px] leading-[1.4] text-[#9ca3af]">
                Reviews are collected and hosted independently by Zocdoc, not by LifeWell.
              </p>
            </div>
          )}

          {ptUrl && (
            <div className={zocdocUrl ? 'mt-10 border-t border-[#dbe3ea] pt-8' : 'mt-6'}>
              <a
                href={ptUrl}
                {...externalLinkProps}
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--lw-accent)] underline-offset-4 hover:underline"
              >
                {psychologyToday.ctaLabel}
                <LongArrow />
              </a>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
