import Link from 'next/link';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { FAQAccordion } from '@/components/sections/FAQAccordion';
import { ServicesGrid } from '@/components/sections/ServicesGrid';
import { SwapButton } from '@/components/ui/SwapButton';
import { telehealthStates, type TelehealthState } from '@/data/telehealth-states';
import type { ServiceSummary } from '@/types/content';
import { provider } from '@/data/provider';

/**
 * /telehealth/[state] — telehealth-availability landing page for a single
 * authorized state. Florida's version additionally covers the real Orlando
 * office; Massachusetts and Arizona are presented as telehealth-only, with
 * no address, map, or implied physical presence.
 */
export function TelehealthStatePageContent({
  state,
  services,
  bookingUrl,
  providerName,
}: {
  state: TelehealthState;
  services: ServiceSummary[];
  bookingUrl: string;
  providerName?: string;
}) {
  const otherStates = telehealthStates.filter((s) => s.slug !== state.slug);
  const [firstIntro, ...restIntro] = state.intro;

  return (
    <div className="bg-white">
      <InnerPageHero
        title={state.headingLead}
        accent={state.headingAccent}
        lead={firstIntro}
        leadSize="subhead"
      />

      <section className="px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto max-w-[840px]">
          {restIntro.map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className="mt-5 text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]"
            >
              {paragraph}
            </p>
          ))}

          <div className="mt-8 rounded-[20px] bg-[#EEF3F7] px-6 py-7 sm:px-8">
            <p className="text-[16px] leading-[1.5] text-[#374151] min-[1181px]:text-[18px]">
              {state.licensureStatement}
            </p>
            {!state.inPersonAvailable && (
              <p className="mt-3 text-[14px] leading-[1.5] text-[#5b6675]">
                Care for {state.name} residents is telehealth-only. Our physical office is in
                Orlando, Florida, and is not available for {state.name} appointments.
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <SwapButton href={bookingUrl}>Book an Appointment</SwapButton>
            <p className="self-center text-[15px] leading-[1.4] text-[#374151]">
              Questions about cost?{' '}
              <Link
                href="/fees-insurance"
                className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline"
              >
                View fees &amp; insurance
              </Link>
              .
            </p>
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
            Every service below is available to {state.name} residents by secure telehealth.
          </p>
          <div className="mt-12">
            <ServicesGrid services={services} columns={4} />
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
            Care in {state.name} is provided by{' '}
            <Link
              href="/bio"
              className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline"
            >
              {providerName || provider.name}
            </Link>
            .
          </p>
          <p className="mt-4 text-[15px] leading-[1.5] text-[#374151]">
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
