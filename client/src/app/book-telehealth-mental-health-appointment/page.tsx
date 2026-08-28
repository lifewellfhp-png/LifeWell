import type { Metadata } from 'next';

import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { JourneyCta } from '@/components/sections/JourneyCta';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { BookingCalendar } from '@/components/sections/BookingCalendar';
import { SecondaryBookingOption } from '@/components/sections/BookingProfiles';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';
import { cmsMetadata } from '@/lib/cms-seo';

const DESCRIPTION =
  'Schedule a confidential and personalized telehealth mental health appointment with a board-certified PMHNP and take the first step toward emotional wellness.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Book an Appointment — Secure Telehealth Scheduling',
    description: DESCRIPTION,
    path: '/book-telehealth-mental-health-appointment',
    image: {
      url: '/images/sections/Book-Telehealth-Mental-Health-Appointment.avif',
      width: 633,
      height: 740,
      alt: 'Booking a telehealth mental health appointment',
    },
  });
}

export default async function BookPage() {
  const cms = await getResolvedContent();
  return (
    <>
      <JsonLd
        data={pageGraph(
          '/book-telehealth-mental-health-appointment',
          'Book an Appointment',
          DESCRIPTION,
          [
            { name: 'Home', href: '/' },
            { name: 'Book an Appointment', href: '/book-telehealth-mental-health-appointment' },
          ]
        )}
        id="booking-schema"
      />

      <div className="bg-white">
        <InnerPageHero
          image={{
            src: '/images/sections/Book-Telehealth-Mental-Health-Appointment.avif',
            alt: 'Booking a telehealth mental health appointment',
          }}
          imageSide="left"
          title="Book Telehealth Mental Health Appointment"
          accent="for Secure, Professional Care"
          lead={DESCRIPTION}
          leadSize="subhead"
        />

        <BookingCalendar src={cms.booking.url} label={cms.booking.label} />

        <SecondaryBookingOption profiles={cms.bookingProfiles} />

        <HowItWorks
          steps={cms.steps}
          heading={cms.howItWorks.heading}
          eyebrow={cms.howItWorks.eyebrow}
          body={cms.howItWorks.body}
          bookingUrl={cms.booking.page}
          tone="transparent"
          showCta={false}
        />

        <JourneyCta
          image={{
            src: '/images/sections/Book-Telehealth-Mental-Health-Appointment.avif',
            alt: '',
            width: 633,
            height: 740,
          }}
          imageSide="right"
          href="#charm-calendar"
          cta="Choose a Time"
        />
      </div>
    </>
  );
}
