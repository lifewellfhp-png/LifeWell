import Image from 'next/image';
import { Container } from '@/components/ui/Section';
import { FeesPillButton } from '@/components/sections/FeesPillButton';
import { InsuranceGrid } from '@/components/sections/InsuranceGrid';
import {
  feesIntro,
  feesClosing,
  psychiatricStatePricing as staticPsychiatricStatePricing,
  pricingTiers as staticPricingTiers,
  additionalInfo,
} from '@/data/pricing';
import { site } from '@/data/site';
import { formatPrice } from '@/lib/utils';
import type { InsuranceCarrier } from '@/types/content';

/**
 * /fees-insurance reorg. New order: intro (one sentence + two buttons) ->
 * insurance we accept (Florida) -> one self-pay psychiatry table (Florida/
 * Massachusetts/Arizona columns) -> Primary Care & Weight Management cards
 * -> payment & superbills -> Good Faith Estimate notice -> one Book an
 * Appointment CTA at the bottom. Every individual price card's own Book
 * button is gone — only the single bottom CTA books. The old FAQ toggles
 * section (feesFaqs/FAQAccordion) is not part of this new order and isn't
 * rendered here anymore; that CMS content and the FAQAccordion component
 * are both untouched, just unused on this page now — flagged as a judgment
 * call since the brief's 7-item list didn't mention FAQs, same as the
 * homepage reorg's Stats/Testimonials precedent.
 *
 * One heading style throughout (solid navy, no mixed green/navy words in a
 * single heading) via HEADING_CLASS below, rather than the site's usual
 * two-tone SectionHeading split — a deliberate, page-scoped exception.
 */
const HEADING_CLASS =
  'font-heading text-[30px] font-normal leading-[1.15] tracking-[-2px] text-[var(--lw-primary)] sm:max-desktop:text-[40px] desktop:text-[46px]';

const PSYCHIATRIC_ROWS = [
  { key: 'initialFee', label: 'Initial Psychiatric Evaluation', duration: '60 min' },
  { key: 'followUpFee', label: 'Follow-Up Medication Management', duration: '30 min' },
] as const;

export function FeesPageContent({
  carriers,
  bookingUrl,
  introHeading = feesIntro.heading,
  introBody = feesIntro.body,
  psychiatricStatePricing = staticPsychiatricStatePricing,
  otherSelfPayPricing = staticPricingTiers,
  insuranceDisclaimer = 'Insurance coverage and network participation vary by plan. Please contact us to verify your benefits and eligibility before scheduling.',
}: {
  carriers?: InsuranceCarrier[];
  bookingUrl?: string;
  introHeading?: string;
  introBody?: string;
  psychiatricStatePricing?: {
    state: string;
    selfPayOnly: boolean;
    slidingScaleAvailable: boolean;
    initialFee: number;
    followUpFee: number;
  }[];
  otherSelfPayPricing?: {
    name: string;
    initialFee: number;
    initialDuration: string;
    followUpFee: number;
    followUpDuration: string;
    includes: string[];
  }[];
  insuranceDisclaimer?: string;
} = {}) {
  const bookHref = bookingUrl || site.booking.page;
  const contactHref = '/contact-telehealth-mental-health-provider';
  const slidingScaleStates = psychiatricStatePricing.filter((p) => p.slidingScaleAvailable).length > 0;
  const selfPayOnlyStates = psychiatricStatePricing.filter((p) => p.selfPayOnly).map((p) => p.state);

  return (
    <div className="bg-white">
      {/* 1. Intro — one sentence + two buttons */}
      <section className="px-5 pb-10 pt-10 sm:max-[1601px]:px-[30px] lg:max-[1601px]:px-10 min-[1601px]:px-[80px]">
        <Container>
          <div className="mx-auto max-w-[70ch] text-center">
            <h1 className={HEADING_CLASS}>{introHeading}</h1>
            <p className="mt-5 text-[16px] leading-[1.5] text-[#374151] desktop:text-[18px]">{introBody}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <FeesPillButton href={bookHref} tone="accent" trackAs="booking_click">
                Book an Appointment
              </FeesPillButton>
              <FeesPillButton href={contactHref} tone="outline">
                Verify My Insurance
              </FeesPillButton>
            </div>
          </div>
        </Container>
      </section>

      {/* 2. Insurance we accept (Florida) */}
      <InsuranceGrid
        showCta={false}
        showDisclaimer={true}
        heading="Insurance We Accept — Florida"
        body="The insurance plans listed below apply to Florida patients only. Massachusetts and Arizona visits are self-pay."
        disclaimer={insuranceDisclaimer}
        carriers={carriers}
      />

      {/* 3. Self-pay psychiatry — one table */}
      <section className="px-5 py-16 sm:max-[1601px]:px-[30px] sm:py-20 lg:max-[1601px]:px-10 min-[1601px]:px-[80px]">
        <Container>
          <h2 className={cnCenter(HEADING_CLASS)}>Self-Pay Psychiatry</h2>

          <div className="mt-10 hidden overflow-hidden rounded-[20px] border border-[#DCE7E9] md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#EEF2FA]">
                  <th className="px-6 py-4 font-heading text-[16px] font-normal text-[var(--lw-primary)]">Service</th>
                  {psychiatricStatePricing.map((p) => (
                    <th key={p.state} className="px-6 py-4 font-heading text-[16px] font-normal text-[var(--lw-primary)]">
                      {p.state}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PSYCHIATRIC_ROWS.map((row, i) => (
                  <tr key={row.key} className={i % 2 === 1 ? 'bg-[#F7FAFC]' : undefined}>
                    <td className="px-6 py-4 text-[15px] font-semibold text-[#374151]">
                      {row.label} <span className="font-normal text-[#6B7280]">({row.duration})</span>
                    </td>
                    {psychiatricStatePricing.map((p) => (
                      <td key={p.state} className="px-6 py-4 text-[15px] text-[#374151]">
                        {formatPrice(p[row.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards instead of a table */}
          <div className="mt-10 space-y-4 md:hidden">
            {psychiatricStatePricing.map((p) => (
              <div key={p.state} className="rounded-[16px] border border-[#DCE7E9] bg-white p-5">
                <h3 className="font-heading text-[20px] font-normal text-[var(--lw-primary)]">{p.state}</h3>
                {p.selfPayOnly && (
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#374151]">Self-Pay Only</p>
                )}
                <dl className="mt-4 space-y-3">
                  {PSYCHIATRIC_ROWS.map((row) => (
                    <div key={row.key} className="flex items-baseline justify-between gap-4">
                      <dt className="text-[14px] text-[#374151]">
                        {row.label} <span className="text-[#6B7280]">({row.duration})</span>
                      </dt>
                      <dd className="shrink-0 font-heading text-[18px] font-normal text-[var(--lw-primary)]">
                        {formatPrice(p[row.key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          {(selfPayOnlyStates.length > 0 || slidingScaleStates) && (
            <p className="mt-6 text-center text-[13px] leading-[1.45] text-[#6B7280]">
              {selfPayOnlyStates.length > 0 && `${selfPayOnlyStates.join(' and ')} visits are self-pay only. `}
              Sliding scale available — contact us to ask about eligibility and availability.
            </p>
          )}
        </Container>
      </section>

      {/* 4. Other self-pay services — Primary Care & Weight Management */}
      <section className="bg-[#F7FAFC] px-5 py-16 sm:max-[1601px]:px-[30px] sm:py-20 lg:max-[1601px]:px-10 min-[1601px]:px-[80px]">
        <Container>
          <h2 className={cnCenter(HEADING_CLASS)}>Other Self-Pay Services</h2>
          <ul className="mt-10 grid list-none gap-6 lg:grid-cols-2 lg:gap-8">
            {otherSelfPayPricing.map((tier) => (
              <li key={tier.name}>
                <article className="flex h-full flex-col rounded-[20px] border-t-4 border-[var(--lw-accent)] bg-white p-6 sm:p-8">
                  <h3 className="font-heading text-[22px] font-normal text-[var(--lw-primary)] sm:text-[24px]">
                    {tier.name}
                  </h3>
                  <p className="mt-3 text-[15px] font-semibold text-[#374151]">
                    Initial visit · {tier.initialDuration} · {formatPrice(tier.initialFee)}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-[#374151]">
                    Follow-up visit · {tier.followUpDuration} · {formatPrice(tier.followUpFee)}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {tier.includes.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-[14px] leading-[1.45] text-[#374151] desktop:text-[16px]">
                        <CheckIcon />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 5. Payment & superbills */}
      <section className="px-5 py-16 sm:max-[1601px]:px-[30px] sm:py-20 lg:max-[1601px]:px-10 min-[1601px]:px-[80px]">
        <Container>
          <div className="mx-auto max-w-[70ch]">
            <h2 className={HEADING_CLASS}>Payment &amp; Superbills</h2>
            <p className="mt-4 text-[14px] leading-[1.45] text-[#374151] sm:max-desktop:text-[16px] desktop:text-[18px]">
              {additionalInfo.body}
            </p>
            <ul className="mt-5 space-y-3">
              {additionalInfo.notes.map((note) => (
                <li key={note.slice(0, 40)} className="flex items-start gap-3 text-[14px] leading-[1.45] text-[#374151] sm:max-desktop:text-[16px] desktop:text-[18px]">
                  <CheckIcon />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* 6. Good Faith Estimate notice */}
      <section className="px-5 pb-16 sm:max-[1601px]:px-[30px] sm:pb-20 lg:max-[1601px]:px-10 min-[1601px]:px-[80px]">
        <Container>
          <div className="mx-auto max-w-[70ch] rounded-[16px] bg-[#EEF2FA] p-6 sm:p-8">
            <h2 className="font-heading text-[20px] font-normal text-[var(--lw-primary)] sm:text-[22px]">
              Good Faith Estimate
            </h2>
            <p className="mt-3 text-[14px] leading-[1.6] text-[#374151] desktop:text-[15px]">
              You have the right to receive a Good Faith Estimate explaining how much your medical care will cost.
              Under the law, health care providers need to give patients who don&apos;t have insurance or who are not
              using insurance an estimate of the bill for medical items and services. For questions or more
              information about your right to a Good Faith Estimate, visit{' '}
              <a
                href="https://www.cms.gov/nosurprises"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--lw-primary)] underline underline-offset-2"
              >
                www.cms.gov/nosurprises
              </a>{' '}
              or call{' '}
              <a href="tel:+18009853059" className="font-semibold text-[var(--lw-primary)] underline underline-offset-2">
                1-800-985-3059
              </a>
              .
            </p>
          </div>
        </Container>
      </section>

      {/* 7. One Book an Appointment CTA at the bottom */}
      <section className="bg-[#F7FAFC] px-5 py-16 sm:max-[1601px]:px-[30px] sm:py-24 lg:max-[1601px]:px-10 lg:py-[100px] min-[1601px]:px-[80px]">
        <div className="mx-auto grid max-w-[1840px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className={HEADING_CLASS}>
              {feesClosing.headingLead} {feesClosing.headingAccent}
            </h2>
            <p className="mt-5 max-w-[42ch] text-[14px] leading-[1.45] text-[#374151] sm:max-desktop:text-[16px] desktop:text-[18px]">
              {feesClosing.body}
            </p>
            <div className="mt-8">
              <FeesPillButton href={bookHref} tone="accent" trackAs="booking_click">
                {feesClosing.cta}
              </FeesPillButton>
            </div>
          </div>
          <div>
            <Image
              src={feesClosing.image.src}
              alt={feesClosing.image.alt}
              width={feesClosing.image.width}
              height={feesClosing.image.height}
              loading="lazy"
              sizes="(min-width: 1024px) 45vw, 92vw"
              className="h-auto w-full rounded-[30px] object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function cnCenter(base: string): string {
  return `${base} mx-auto max-w-[36ch] text-center`;
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className="mt-1.5 shrink-0"
    >
      <path
        d="m2.8 8.2 3.2 3.2 7.2-7.2"
        stroke="var(--lw-accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
