import Image from 'next/image';
import { Container } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { InsuranceGrid } from '@/components/sections/InsuranceGrid';
import { FAQAccordion } from '@/components/sections/FAQAccordion';
import {
  feesIntro,
  feesClosing,
  selfPay,
  pricingTiers,
  psychiatricStatePricing as staticPsychiatricStatePricing,
  additionalInfo,
  feesFaqs,
} from '@/data/pricing';
import { site } from '@/data/site';
import { formatPrice } from '@/lib/utils';
import type { Faq, InsuranceCarrier } from '@/types/content';

/**
 * /fees-insurance — Elementor post 50919: hero card (photo left), self-pay
 * rates, program packages, accepted plans, FAQ toggles, closing CTA.
 */
export function FeesPageContent({
  carriers,
  faqs = feesFaqs,
  bookingUrl,
  introHeading = feesIntro.heading,
  introBody = feesIntro.body,
  selfPayBody = selfPay.body,
  psychiatricStatePricing = staticPsychiatricStatePricing,
  insuranceDisclaimer = 'Insurance coverage and network participation vary by plan. Please contact us to verify your benefits and eligibility before scheduling.',
}: {
  carriers?: InsuranceCarrier[];
  faqs?: Faq[];
  bookingUrl?: string;
  introHeading?: string;
  introBody?: string;
  selfPayBody?: string[];
  psychiatricStatePricing?: {
    state: string;
    selfPayOnly: boolean;
    slidingScaleAvailable: boolean;
    initialFee: number;
    followUpFee: number;
  }[];
  insuranceDisclaimer?: string;
} = {}) {
  const bookHref = bookingUrl || site.booking.page;
  return (
    <div className="bg-white">
      <FeesHero heading={introHeading} body={introBody} />

      <section className="px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto max-w-[1840px]">
          <h2 className="mx-auto max-w-[18ch] text-center font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:text-[48px] min-[1181px]:text-[56px]">
            <span className="text-[var(--lw-accent)]">Psychiatric </span>
            <span className="italic tracking-normal text-[var(--lw-primary)]">Self-Pay Pricing</span>
          </h2>
          <div className="mx-auto mt-6 max-w-[70ch] space-y-4 text-center">
            {selfPayBody.map((p) => (
              <p key={p.slice(0, 32)} className="text-[14px] leading-[1.45] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
                {p}
              </p>
            ))}
          </div>

          <ul className="mt-12 grid list-none gap-10 lg:mt-16 lg:grid-cols-3 lg:gap-[30px]">
            {(psychiatricStatePricing || []).map((pricing) => (
              <li key={pricing.state}>
                <article className="flex h-full flex-col rounded-[20px] bg-[#EEF3F7] p-6 sm:p-8">
                  <h3 className="font-heading text-[26px] font-normal leading-[1.15] text-[var(--lw-accent)] sm:text-[30px]">
                    {pricing.state}
                  </h3>
                  {pricing.selfPayOnly ? (
                    <p className="mt-3 text-[12px] font-semibold uppercase tracking-[1px] text-[var(--lw-primary)]">
                      Self-Pay Only
                    </p>
                  ) : null}
                  {pricing.slidingScaleAvailable ? (
                    <p className="mt-3 text-[14px] font-semibold text-[var(--lw-primary)]">Sliding Scale Available</p>
                  ) : null}
                  <p className="mt-6 font-heading text-[22px] text-[var(--lw-primary)] sm:text-[24px]">
                    Initial Psychiatric Evaluation: {formatPrice(pricing.initialFee)}
                  </p>
                  <p className="mt-3 font-heading text-[22px] text-[var(--lw-primary)] sm:text-[24px]">
                    Follow-Up Medication Management: {formatPrice(pricing.followUpFee)}
                  </p>
                  <div className="mt-auto pt-6">
                    <SwapButton href={bookHref}>Book an Appointment</SwapButton>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <h2 className="mx-auto mt-20 max-w-[18ch] text-center font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:text-[48px] min-[1181px]:text-[56px]">
            <span className="text-[var(--lw-accent)]">Other </span>
            <span className="italic tracking-normal text-[var(--lw-primary)]">Self-Pay Services</span>
          </h2>
          <ul className="mt-12 grid list-none gap-10 lg:mt-16 lg:grid-cols-2 lg:gap-[30px]">
            {pricingTiers.filter((tier) => tier.name !== 'Mental Health').map((tier) => (
              <li key={tier.name}>
                <article className="flex h-full flex-col">
                  <h3 className="font-body text-[12px] font-semibold uppercase tracking-[1px] text-[#374151] sm:text-[13px] min-[1181px]:text-[15px]">
                    {tier.name}
                  </h3>
                  <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <p className="font-heading text-[22px] font-normal leading-[1.25] tracking-[-1px] text-[var(--lw-primary)] sm:text-[24px] min-[1181px]:text-[30px]">
                      Initial: {formatPrice(tier.initialFee)}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#374151] sm:text-[12px] min-[1181px]:text-[13px]">
                      {tier.initialDuration}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <p className="font-heading text-[22px] font-normal leading-[1.25] tracking-[-1px] text-[var(--lw-primary)] sm:text-[24px] min-[1181px]:text-[30px]">
                      Follow-up: {formatPrice(tier.followUpFee)}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#374151] sm:text-[12px] min-[1181px]:text-[13px]">
                      {tier.followUpDuration}
                    </p>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {tier.includes.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-[14px] leading-[1.45] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
                        <CheckIcon />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <SwapButton href={bookHref}>Book an Appointment</SwapButton>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto max-w-[1840px]">
          <div className="mt-16 max-w-[70ch] lg:mt-[80px]">
            <h2 className="font-heading text-[22px] font-normal leading-[1.25] tracking-[-1px] text-[var(--lw-accent)] sm:text-[24px] min-[1181px]:text-[30px]">
              {additionalInfo.heading}
            </h2>
            <p className="mt-4 text-[14px] leading-[1.45] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
              {additionalInfo.body}
            </p>
            <h3 className="mt-8 font-body text-[12px] font-semibold uppercase tracking-[1px] text-[#374151] sm:text-[13px] min-[1181px]:text-[15px]">
              Note:
            </h3>
            <div className="mt-3 space-y-4">
              {additionalInfo.notes.map((note) => (
                <p key={note.slice(0, 40)} className="text-[14px] leading-[1.45] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
                  {note}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <InsuranceGrid
        showCta={false}
        showDisclaimer={true}
        heading="Accepted Insurance Plans — Florida Only"
        body="The insurance plans listed below apply to eligible Florida patients only. Massachusetts and Arizona psychiatric visits are self-pay only at this time."
        disclaimer={insuranceDisclaimer}
        carriers={carriers}
      />

      <section className="bg-white px-5 py-16 sm:px-[30px] sm:py-24 lg:px-10 lg:py-[100px] min-[1601px]:px-[80px]" aria-labelledby="fees-faq-heading">
        <Container>
          <p className="mx-auto w-fit rounded-[7px] bg-[#EEF3F7] px-[15px] pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:text-[12px] min-[1181px]:text-[13px]">
            FAQ
          </p>
          <h2
            id="fees-faq-heading"
            className="mt-5 text-center font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:text-[48px] min-[1181px]:text-[56px]"
          >
            <span className="text-[var(--lw-accent)]">Your Questions </span>
            <span className="italic tracking-normal text-[var(--lw-primary)]">About Payment &amp; Insurance</span>
          </h2>
          <div className="mx-auto mt-10 max-w-[52rem] lg:mt-14">
            <FAQAccordion faqs={faqs} variant="toggles" defaultOpen={[]} />
          </div>
        </Container>
      </section>

      <section className="bg-white px-5 py-16 sm:px-[30px] sm:py-24 lg:px-10 lg:py-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto grid max-w-[1840px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="max-w-[14ch] font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:text-[48px] min-[1181px]:text-[56px]">
              <span className="italic tracking-normal text-[var(--lw-primary)]">{feesClosing.headingLead} </span>
              <span className="text-[var(--lw-accent)]">{feesClosing.headingAccent}</span>
            </h2>
            <p className="mt-5 max-w-[42ch] text-[14px] leading-[1.45] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
              {feesClosing.body}
            </p>
            <div className="mt-8">
              <SwapButton href={bookHref}>{feesClosing.cta}</SwapButton>
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

function FeesHero({ heading, body }: { heading: string; body: string }) {
  const isDefault = heading === feesIntro.heading;
  return (
    <section className="px-5 pb-16 pt-4 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
      <div className="mx-auto flex max-w-[1840px] flex-col overflow-hidden rounded-[20px] bg-[#EEF3F7] sm:rounded-[30px] lg:min-h-[570px] lg:flex-row">
        <div className="relative min-h-[400px] sm:min-h-[500px] lg:min-h-[570px] lg:w-[55%]">
          <Image
            src={feesIntro.image.src}
            alt={feesIntro.image.alt}
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover object-center"
          />
        </div>
        <div className="flex flex-col justify-center gap-8 px-5 py-10 sm:gap-10 sm:px-[60px] sm:py-[100px] lg:w-[45%] lg:px-20 lg:py-5">
          <h1 className="font-heading text-[35px] font-normal leading-[1.15] tracking-[-3px] sm:text-[48px] min-[1181px]:text-[56px]">
            {isDefault ? (
              <>
                <span className="italic tracking-normal text-[var(--lw-primary)] sm:text-[50px] sm:leading-[1.05] min-[1181px]:text-[60px]">
                  Transparent{' '}
                </span>
                <span className="text-[var(--lw-accent)]">Mental Health Fees and Insurance </span>
                <span className="italic tracking-normal text-[var(--lw-primary)] sm:text-[50px] sm:leading-[1.05] min-[1181px]:text-[60px]">
                  Plans
                </span>
              </>
            ) : (
              <span className="text-[var(--lw-accent)]">{heading}</span>
            )}
          </h1>
          <p className="text-[14px] leading-[1.45] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
            {body}
          </p>
        </div>
      </div>
    </section>
  );
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
