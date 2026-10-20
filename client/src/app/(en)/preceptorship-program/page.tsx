import type { Metadata } from 'next';

import { JsonLd } from '@/components/seo/JsonLd';
import { PreceptorshipPageContent } from '@/components/sections/PreceptorshipPageContent';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Structured PMHNP and Family Nurse Practitioner preceptorship opportunities at LifeWell. Availability depends on program fit, capacity, and placement review.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'PMHNP & FNP Preceptorship Program | LifeWell Health',
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
