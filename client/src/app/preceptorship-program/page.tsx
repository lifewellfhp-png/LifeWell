import type { Metadata } from 'next';

import { JsonLd } from '@/components/seo/JsonLd';
import { PreceptorshipPageContent } from '@/components/sections/PreceptorshipPageContent';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Explore structured PMHNP and Family Nurse Practitioner preceptorship opportunities with LifeWell Family Health & Psychiatry. Availability is based on program requirements, preceptor capacity, and placement review.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Preceptorship Program for PMHNP & FNP Students | LifeWell',
    description: DESCRIPTION,
    path: '/preceptorship-program',
  });
}

export default async function PreceptorshipProgramPage() {
  return (
    <>
      <JsonLd
        data={pageGraph('/preceptorship-program', 'Preceptorship Program', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'Preceptorship Program', href: '/preceptorship-program' },
        ])}
        id="preceptorship-program-schema"
      />
      <PreceptorshipPageContent />
    </>
  );
}
