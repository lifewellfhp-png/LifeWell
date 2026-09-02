import type { Metadata } from 'next';

import { BioPageContent } from '@/components/sections/BioPageContent';
import { JsonLd } from '@/components/seo/JsonLd';

import { provider } from '@/data/provider';
import { cmsMetadata } from '@/lib/cms-seo';
import { providerPageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Meet Lourdie Chachoute, FNP-C, PMHNP-BC — a dual board-certified Family and Psychiatric-Mental Health Nurse Practitioner with over 15 years of clinical experience, providing telehealth and in-person psychiatric care in Orlando, FL.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Meet Your Provider — Lourdie Chachoute, PMHNP-BC',
    description: DESCRIPTION,
    path: '/bio',
    image: {
      url: cms.provider?.photoUrl || provider.image.src,
      width: provider.image.width,
      height: provider.image.height,
      alt: cms.provider?.name || provider.image.alt,
    },
  });
}

export default async function BioPage() {
  const cms = await getResolvedContent();
  const loc = cms.locations.find((row) => row.isPrimary) ?? cms.locations[0];
  return (
    <>
      <JsonLd data={providerPageGraph(DESCRIPTION, cms.provider ?? undefined)} id="provider-schema" />
      <BioPageContent
        overlay={cms.provider ?? undefined}
        testimonials={cms.testimonials}
        stats={cms.stats}
        bookingUrl={cms.booking.page}
        phone={cms.settings.practicePhone || loc?.phone}
        email={cms.settings.practiceEmail || loc?.email}
        bookingProfiles={cms.bookingProfiles}
      />
    </>
  );
}
