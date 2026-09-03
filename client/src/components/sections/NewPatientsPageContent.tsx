import Link from 'next/link';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { OutlineButton, SwapButton } from '@/components/ui/SwapButton';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { site } from '@/data/site';
import {
  newPatientsHero,
  beforeYourVisit,
  whatToExpect,
  telehealthSection,
  inPersonSection,
  insuranceSection,
  questionsSection,
} from '@/data/new-patients';

const CONTACT_HREF = '/contact-telehealth-mental-health-provider';

/**
 * /new-patients — onboarding/reassurance page. Deliberately does not
 * restate FAQs, Fees & Insurance, or the booking flow; it links to each
 * instead. See P3-E3B4/P3-E3B5.
 */
export function NewPatientsPageContent() {
  const bookHref = site.booking.page;

  return (
    <div className="bg-white">
      <InnerPageHero title={newPatientsHero.titleLead} accent={newPatientsHero.titleAccent} lead={newPatientsHero.lead}>
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SwapButton href={bookHref} trackAs="booking_click">Book an Appointment</SwapButton>
          <OutlineButton href={CONTACT_HREF} variant="onLight" showArrow={false}>
            Contact Us
          </OutlineButton>
        </div>
      </InnerPageHero>

      <Section tone="transparent" spacing="sm" aria-labelledby="before-visit-heading">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="before-visit-heading"
            align="left"
            title={beforeYourVisit.heading}
            accent={beforeYourVisit.headingAccent}
            description={beforeYourVisit.body}
          />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {beforeYourVisit.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-[16px] bg-[#EEF3F7] px-5 py-4 text-[14px] leading-[1.45] text-[#374151] sm:text-[16px]"
              >
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tone="muted" spacing="sm" aria-labelledby="what-to-expect-heading" className="bg-[#F4F7FA]">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="what-to-expect-heading"
            align="left"
            title={whatToExpect.heading}
            accent={whatToExpect.headingAccent}
          />
          <div className="mt-6 space-y-4">
            {whatToExpect.body.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="text-[14px] leading-[1.45] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
                {paragraph}
              </p>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="transparent" spacing="sm" aria-labelledby="telehealth-heading">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="telehealth-heading"
            align="left"
            title={telehealthSection.heading}
            accent={telehealthSection.headingAccent}
            description={telehealthSection.body}
          />
          <ul className="mt-6 flex flex-wrap gap-3">
            {telehealthSection.states.map((state) => (
              <li key={state.href}>
                <Link
                  href={state.href}
                  className="inline-flex items-center rounded-[30px] border border-border-strong px-5 py-2.5 text-[14px] font-semibold text-[var(--lw-primary)] no-underline transition-colors duration-300 hover:bg-[var(--lw-primary)] hover:text-white sm:text-[15px]"
                >
                  Telehealth in {state.name}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tone="muted" spacing="sm" aria-labelledby="in-person-heading" className="bg-[#F4F7FA]">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="in-person-heading"
            align="left"
            title={inPersonSection.heading}
            accent={inPersonSection.headingAccent}
            description={inPersonSection.body}
          />
          <address className="mt-6 not-italic text-[14px] leading-[1.6] text-[#374151] sm:text-[16px]">
            {inPersonSection.address.street}
            <br />
            {inPersonSection.address.cityLine}
          </address>
        </Container>
      </Section>

      <Section tone="transparent" spacing="sm" aria-labelledby="insurance-heading">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="insurance-heading"
            align="left"
            title={insuranceSection.heading}
            accent={insuranceSection.headingAccent}
            description={insuranceSection.body}
          />
          <div className="mt-4">
            <Link
              href="/fees-insurance"
              className="text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline sm:text-[16px]"
            >
              View Fees &amp; Insurance
            </Link>
          </div>
        </Container>
      </Section>

      <Section tone="muted" spacing="sm" aria-labelledby="questions-heading" className="bg-[#F4F7FA]">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="questions-heading"
            align="left"
            title={questionsSection.heading}
            accent={questionsSection.headingAccent}
            description={questionsSection.body}
          />
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            <li>
              <Link
                href="/faqs"
                className="text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline sm:text-[16px]"
              >
                Read our FAQs
              </Link>
            </li>
            <li>
              <Link
                href={CONTACT_HREF}
                className="text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline sm:text-[16px]"
              >
                Contact Us
              </Link>
            </li>
          </ul>
        </Container>
      </Section>

      <Section tone="inverse" aria-labelledby="new-patients-cta-heading">
        <Container size="narrow">
          <div className="text-center">
            <h2
              id="new-patients-cta-heading"
              className="mx-auto max-w-[22ch] text-[30px] font-normal leading-[1.15] tracking-normal text-text-inverse sm:text-[48px] min-[1181px]:text-[56px]"
            >
              Ready to Get Started?
            </h2>
            <p className="mx-auto mt-6 max-w-[56ch] text-[16px] leading-[1.45] text-text-inverse/85 min-[1181px]:text-[18px]">
              Book your first appointment online, or reach out if you have questions before scheduling.
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <SwapButton href={bookHref} trackAs="booking_click">Book an Appointment</SwapButton>
              <OutlineButton href={CONTACT_HREF} variant="onDark" showArrow={false}>
                Contact Us
              </OutlineButton>
            </div>
          </div>
        </Container>
      </Section>
    </div>
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
