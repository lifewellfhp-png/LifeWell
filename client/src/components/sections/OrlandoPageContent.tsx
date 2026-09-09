import Image from 'next/image';
import Link from 'next/link';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { OutlineButton, SwapButton } from '@/components/ui/SwapButton';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { site } from '@/data/site';
import {
  orlandoHero,
  orlandoOffice,
  orlandoCareOptions,
  orlandoProviderSection,
  orlandoNewPatients,
  orlandoNextSteps,
} from '@/data/orlando';

const CONTACT_HREF = '/contact-telehealth-mental-health-provider';

/**
 * /orlando-psychiatric-care — canonical local-search landing page for
 * Orlando, FL. Deliberately links to /new-patients, /fees-insurance, /faqs
 * and /telehealth/florida rather than restating their content, matching the
 * established pattern in NewPatientsPageContent.tsx.
 */
export function OrlandoPageContent() {
  const bookHref = site.booking.page;

  return (
    <div className="bg-white">
      <InnerPageHero
        title={orlandoHero.titleLead}
        accent={orlandoHero.titleAccent}
        lead={orlandoHero.lead}
      >
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SwapButton href={bookHref} trackAs="booking_click">Book an Appointment</SwapButton>
          <OutlineButton href={orlandoOffice.phoneHref} variant="onLight" showArrow={false}>
            Call {orlandoOffice.phoneDisplay}
          </OutlineButton>
        </div>
      </InnerPageHero>

      <Section tone="transparent" spacing="sm" aria-labelledby="orlando-office-heading">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="orlando-office-heading"
            align="left"
            title={orlandoOffice.heading}
            accent={orlandoOffice.headingAccent}
            description={orlandoOffice.body}
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-start">
            <div>
              <address className="not-italic text-[14px] leading-[1.6] text-[#374151] sm:text-[16px]">
                <strong className="block text-[16px] font-semibold text-[var(--lw-primary)] sm:text-[18px]">
                  {site.name}
                </strong>
                {orlandoOffice.street}
                <br />
                {orlandoOffice.cityLine}
              </address>

              <p className="mt-4 text-[14px] leading-[1.6] text-[#374151] sm:text-[16px]">
                <a
                  href={orlandoOffice.phoneHref}
                  className="font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline"
                >
                  {orlandoOffice.phoneDisplay}
                </a>
              </p>

              <p className="mt-2">
                <a
                  href={orlandoOffice.directionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline sm:text-[16px]"
                >
                  Get Directions
                </a>
              </p>

              <dl className="mt-6 space-y-1 text-[14px] leading-[1.6] text-[#374151] sm:text-[16px]">
                {orlandoOffice.hours.map((h) => (
                  <div key={h.days} className="flex gap-2">
                    <dt className="font-semibold text-[var(--lw-primary)]">{h.days}:</dt>
                    <dd>{h.display}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="min-h-[280px] overflow-hidden rounded-[20px] sm:min-h-[340px]">
              <iframe
                title={`${orlandoOffice.street}, ${orlandoOffice.cityLine}`}
                src={orlandoOffice.mapSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full min-h-[280px] w-full border-0 sm:min-h-[340px]"
              />
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="muted" spacing="sm" aria-labelledby="orlando-care-options-heading" className="bg-[#F4F7FA]">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="orlando-care-options-heading"
            align="left"
            title={orlandoCareOptions.heading}
            accent={orlandoCareOptions.headingAccent}
            description={orlandoCareOptions.body}
          />
          <ul className="mt-6 flex flex-wrap gap-3">
            {orlandoCareOptions.services.map((service) => (
              <li key={service.href}>
                <Link
                  href={service.href}
                  className="inline-flex items-center rounded-[30px] border border-border-strong px-5 py-2.5 text-[14px] font-semibold text-[var(--lw-primary)] no-underline transition-colors duration-300 hover:bg-[var(--lw-primary)] hover:text-white sm:text-[15px]"
                >
                  {service.title}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Link
              href={orlandoCareOptions.telehealthHref}
              className="text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline sm:text-[16px]"
            >
              {orlandoCareOptions.telehealthLinkLabel}
            </Link>
          </div>
        </Container>
      </Section>

      <Section tone="transparent" spacing="sm" aria-labelledby="orlando-provider-heading">
        <Container size="narrow">
          <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:items-center">
            <Image
              src={orlandoProviderSection.image.src}
              alt={orlandoProviderSection.image.alt}
              width={200}
              height={Math.round((200 * orlandoProviderSection.image.height) / orlandoProviderSection.image.width)}
              className="rounded-[16px] object-cover"
            />
            <div>
              <SectionHeading
                as="h2"
                id="orlando-provider-heading"
                align="left"
                title={orlandoProviderSection.heading}
                accent={orlandoProviderSection.headingAccent}
                description={orlandoProviderSection.body}
              />
              <div className="mt-4">
                <Link
                  href={orlandoProviderSection.href}
                  className="text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline sm:text-[16px]"
                >
                  {orlandoProviderSection.linkLabel}
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="muted" spacing="sm" aria-labelledby="orlando-new-patients-heading" className="bg-[#F4F7FA]">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="orlando-new-patients-heading"
            align="left"
            title={orlandoNewPatients.heading}
            accent={orlandoNewPatients.headingAccent}
            description={orlandoNewPatients.body}
          />
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            <li>
              <Link
                href={orlandoNewPatients.newPatientsHref}
                className="text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline sm:text-[16px]"
              >
                {orlandoNewPatients.newPatientsLabel}
              </Link>
            </li>
            <li>
              <Link
                href={orlandoNewPatients.feesHref}
                className="text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline sm:text-[16px]"
              >
                {orlandoNewPatients.feesLabel}
              </Link>
            </li>
            <li>
              <Link
                href="/faqs"
                className="text-[15px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline sm:text-[16px]"
              >
                Read our FAQs
              </Link>
            </li>
          </ul>
        </Container>
      </Section>

      <Section tone="inverse" aria-labelledby="orlando-cta-heading">
        <Container size="narrow">
          <div className="text-center">
            <h2
              id="orlando-cta-heading"
              className="mx-auto max-w-[22ch] text-[30px] font-normal leading-[1.15] tracking-normal text-text-inverse sm:max-desktop:text-[48px] desktop:text-[56px]"
            >
              {orlandoNextSteps.heading} {orlandoNextSteps.headingAccent}
            </h2>
            <p className="mx-auto mt-6 max-w-[56ch] text-[16px] leading-[1.45] text-text-inverse/85 desktop:text-[18px]">
              {orlandoNextSteps.body}
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
