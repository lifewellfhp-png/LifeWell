import type { Metadata } from 'next';

import { OurServicesPageContent } from '@/components/sections/OurServicesPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { cmsMetadata } from '@/lib/cms-seo';
import { serviceListGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Psychiatric evaluations, medication management, chronic disease care, physicals, and wellness counseling. Telehealth in FL, MA & AZ; in-person in Orlando.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Our Services — Telehealth Psychiatry & Primary Care',
    description: DESCRIPTION,
    path: '/our-services',
    image: {
      url: '/images/sections/SERVIES-IMG.avif',
      width: 1180,
      height: 990,
      alt: 'Comprehensive online mental health services',
    },
  });
}

export default async function OurServicesPage() {
  const cms = await getResolvedContent();

  return (
    <>
      <JsonLd data={serviceListGraph(cms.serviceSummaries, DESCRIPTION)} id="services-schema" />
      <OurServicesPageContent services={cms.serviceSummaries} bookingUrl={cms.booking.page} />
    </>
  );
}
