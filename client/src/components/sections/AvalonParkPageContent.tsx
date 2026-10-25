import Link from 'next/link';

import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { Container, Section } from '@/components/ui/Section';
import { OutlineButton, SwapButton } from '@/components/ui/SwapButton';
import { site } from '@/data/site';
import { orlandoOffice } from '@/data/orlando';

export function AvalonParkPageContent() {
  return (
    <div className="bg-white">
      <InnerPageHero
        title="Psychiatric care near Avalon Park"
        accent="in Orlando"
        lead="LifeWell offers in-person psychiatric evaluations and medication management at our Avalon Park office, with telehealth available when you are in Florida, Massachusetts, or Arizona."
      >
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SwapButton href={site.booking.page} trackAs="booking_click">Book an Appointment</SwapButton>
          <OutlineButton href={site.contact.phoneHref} variant="onLight" showArrow={false}>
            Call {site.contact.phone}
          </OutlineButton>
        </div>
      </InnerPageHero>

      <Section tone="transparent" spacing="sm" aria-labelledby="avalon-office">
        <Container size="narrow">
          <h2 id="avalon-office">Our Avalon Park office</h2>
          <p className="mt-4 max-w-2xl leading-8 text-text-secondary">
            The LifeWell office is at {site.address.full}. In-person psychiatric evaluations and
            medication management are available in Orlando. Telehealth is also available for
            eligible patients in our authorized states.
          </p>
          <address className="mt-6 not-italic leading-8 text-text-secondary">
            <strong className="text-text-primary">{site.name}</strong>
            <br />
            {site.address.full}
            <br />
            <a href={site.contact.phoneHref} className="font-semibold text-text-link underline">
              {site.contact.phone}
            </a>
          </address>
          <a
            href={orlandoOffice.directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block font-semibold text-text-link underline"
          >
            Get directions to the Avalon Park office
          </a>
        </Container>
      </Section>

      <Section tone="muted" spacing="sm" aria-labelledby="avalon-services">
        <Container size="narrow">
          <h2 id="avalon-services">Services and eligibility</h2>
          <p className="mt-4 leading-8 text-text-secondary">
            LifeWell provides psychiatric evaluation, medication management when appropriate, and
            follow-up care for patients age 12 and older. Care can include coordination with your
            therapist or counselor with your permission.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/services/psychiatric-evaluations" className="font-semibold text-text-link underline">
              Psychiatric evaluations
            </Link>
            <Link href="/services/medication-management" className="font-semibold text-text-link underline">
              Medication management
            </Link>
            <Link href="/fees-insurance" className="font-semibold text-text-link underline">
              Fees and insurance
            </Link>
          </div>
        </Container>
      </Section>
    </div>
  );
}
