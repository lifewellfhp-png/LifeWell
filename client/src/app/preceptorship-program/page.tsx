import type { Metadata } from 'next';

import { ServicePageContent } from '@/components/sections/ServicePageContent';
import { getServiceSummary } from '@/data/service-catalog';
import { cmsMetadata } from '@/lib/cms-seo';
import { getResolvedContent } from '@/lib/cms-resolve';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  const summary = cms.serviceSummaries.find((s) => s.slug === 'preceptorship-program') || getServiceSummary('preceptorship-program');

  return cmsMetadata(cms, {
    title: 'Preceptorship Program | Professional Education',
    description:
      summary?.description ||
      'Professional education and mentorship opportunities for students and early-career clinicians.',
    path: '/preceptorship-program',
    image: summary
      ? {
          url: summary.image.src,
          width: summary.image.width,
          height: summary.image.height,
          alt: summary.image.alt,
        }
      : undefined,
  });
}

export default function PreceptorshipProgramPage() {
  return <ServicePageContent slug="preceptorship-program" />;
}
