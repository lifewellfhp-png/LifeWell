import type { Metadata } from 'next';

import { TestimonialsPageContent } from '@/components/sections/TestimonialsPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Read authentic telehealth mental health testimonials from individuals who have experienced compassionate, professional, and confidential online mental health support.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Patient Testimonials — Telehealth Mental Health Care',
    description: DESCRIPTION,
    path: '/telehealth-mental-health-testimonials',
    image: {
      url: '/images/sections/Telehealth-Mental-Health-Testimonials.avif',
      width: 633,
      height: 633,
      alt: 'Patient testimonials for telehealth mental health care',
    },
  });
}

export default async function TestimonialsPage() {
  const cms = await getResolvedContent();

  return (
    <>
      <JsonLd
        data={pageGraph(
          '/telehealth-mental-health-testimonials',
          'Patient Testimonials',
          DESCRIPTION,
          [
            { name: 'Home', href: '/' },
            { name: 'Testimonials', href: '/telehealth-mental-health-testimonials' },
          ]
        )}
        id="testimonials-schema"
      />
      <TestimonialsPageContent
        testimonials={cms.testimonials}
        bookingUrl={cms.booking.page}
        bookingProfiles={cms.bookingProfiles}
      />
    </>
  );
}
