import Link from 'next/link';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { FAQAccordion } from '@/components/sections/FAQAccordion';
import { ServicesGrid } from '@/components/sections/ServicesGrid';
import { SwapButton } from '@/components/ui/SwapButton';
import { telehealthStates, type TelehealthState } from '@/data/telehealth-states';
import type { ServiceSummary } from '@/types/content';

const DEFAULT_PRICING_NOTE = 'Contact us for current self-pay pricing.';

function formatFee(fee: number, label: string | null): string {
  const amount = `$${fee % 1 === 0 ? fee.toFixed(0) : fee.toFixed(2)}`;
  return label ? `${amount} ${label}` : amount;
}

/**
 * /telehealth/[state] — telehealth-availability landing page for a single
 * authorized state, resolved from the CMS (see cms-resolve.ts) with a
 * static fallback. Florida's version additionally covers the real Orlando
 * office; Massachusetts and Arizona are telehealth-only, self-pay-only —
 * whether a state has a physical office is intentionally NOT a CMS field
 * (see the note on TelehealthState), so no admin edit can imply a fake
 * MA/AZ location.
 */
export function TelehealthStatePageContent({
  state,
  services,
  bookingUrl,
}: {
  state: TelehealthState;
  services: ServiceSummary[];
  bookingUrl: string;
}) {
  const inPersonAvailable = state.code === 'FL';
  const otherStates = telehealthStates.filter((s) => s.slug !== state.slug);
  const bodyParagraphs = state.body;

  /**
   * Massachusetts and Arizona are authorized for psychiatric telehealth
   * only (self-pay, no physical office) — Primary Care / FNP-scope
   * services (weight management, annual physicals, chronic disease
   * management, etc.) are not an approved offering there. Florida keeps
   * the full catalog unchanged. Filtering by `category` — rather than a
   * hardcoded slug list — means a future service is only ever shown to
   * MA/AZ if it's explicitly tagged `psychiatric`; anything else (or an
   * unrecognized category) is excluded by default.
   */
  const eligibleServices = inPersonAvailable
    ? services
    : services.filter((s) => s.category === 'psychiatric');

  return (
    <div className="bg-white">
      <InnerPageHero
        image={state.heroImage ?? undefined}
        imageSide="left"
        title={state.heading}
        lead={state.subheading}
        leadSize="subhead"
      >
        {state.badge && (
          <p className="mt-6 text-[12px] font-light leading-[1.45] text-[#5b6675] sm:text-[14px]">
            {state.badge}
          </p>
        )}
      </InnerPageHero>

      <section className="px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto max-w-[840px]">
          {bodyParagraphs.map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className="mt-5 text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]"
            >
              {paragraph}
            </p>
          ))}

          <div className="mt-8 rounded-[20px] bg-[#EEF3F7] px-6 py-7 sm:px-8">
            <p className="text-[16px] leading-[1.5] text-[#374151] min-[1181px]:text-[18px]">
              {state.careMode}
            </p>
            {!inPersonAvailable && (
              <p className="mt-3 text-[14px] leading-[1.5] text-[#5b6675]">
                Care for {state.name} residents is telehealth-only. Our physical office is in
                Orlando, Florida, and is not available for {state.name} appointments.
              </p>
            )}

            {state.insuranceMode === 'self_pay_only' && state.selfPayEnabled && (
              <p className="mt-4 text-[16px] font-semibold leading-[1.5] text-[var(--lw-primary)] min-[1181px]:text-[18px]">
                {state.selfPayFee
                  ? formatFee(state.selfPayFee, state.selfPayFeeLabel)
                  : state.pricingNote || DEFAULT_PRICING_NOTE}
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <SwapButton href={bookingUrl}>{state.primaryCta.label}</SwapButton>
            {state.insuranceMode === 'existing' ? (
              <p className="self-center text-[15px] leading-[1.4] text-[#374151]">
                Questions about cost?{' '}
                <Link
                  href={state.secondaryCta.href}
                  className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline"
                >
                  {state.secondaryCta.label}
                </Link>
                .
              </p>
            ) : (
              <Link
                href={state.secondaryCta.href}
                className="self-center text-[15px] font-semibold leading-[1.4] text-[var(--lw-accent)] underline-offset-2 hover:underline"
              >
                {state.secondaryCta.label}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#F7FAFC] px-5 py-16 sm:px-[30px] sm:py-24 lg:px-10 lg:py-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto max-w-[1840px]">
          <h2 className="text-center font-heading text-[30px] font-normal leading-[1.15] tracking-[-2px] sm:text-[48px] min-[1181px]:text-[56px]">
            <span className="text-[var(--lw-accent)]">Services Available in </span>
            <span className="italic text-[var(--lw-primary)]">{state.name}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[46rem] text-center text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
            {inPersonAvailable
              ? `Every service below is available to ${state.name} residents by secure telehealth.`
              : `Psychiatric services available to ${state.name} patients by telehealth.`}
          </p>
          <div className="mt-12">
            <ServicesGrid services={eligibleServices} columns={4} />
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-[30px] sm:py-24 lg:px-10 lg:py-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto max-w-[920px]">
          <h2 className="text-center font-heading text-[30px] font-normal leading-[1.15] tracking-[-2px] sm:text-[48px] min-[1181px]:text-[56px]">
            <span className="text-[var(--lw-accent)]">{state.name} </span>
            <span className="italic text-[var(--lw-primary)]">FAQs</span>
          </h2>
          <div className="mt-12">
            <FAQAccordion faqs={state.faqs} headingLevel={2} variant="toggles" />
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto max-w-[920px] rounded-[20px] border border-[#E1E8EE] px-6 py-8 sm:px-8">
          <p className="text-[15px] leading-[1.5] text-[#374151]">
            Also serving:{' '}
            {otherStates.map((s, i) => (
              <span key={s.slug}>
                <Link
                  href={`/telehealth/${s.slug}`}
                  className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline"
                >
                  {s.name}
                </Link>
                {i < otherStates.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
        </div>
      </section>
    </div>
  );
}
