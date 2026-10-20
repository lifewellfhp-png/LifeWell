import type { Metadata } from 'next';
import { LegalPageTemplate, getLegalPage } from '@/components/sections/LegalPageTemplate';
import { cmsMetadata } from '@/lib/cms-seo';
import { getResolvedContent } from '@/lib/cms-resolve';

const SLUG = 'accessibility-statement';
const page = getLegalPage(SLUG);

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Accessibility Statement | LifeWell Mental Health FHP',
    description:
      page?.seoDescription ??
      page?.intro[0]?.slice(0, 158) ??
      'Accessibility Statement for LifeWell Family Health & Psychiatry.',
    path: `/${SLUG}`,
  });
}

export default function Page() {
  return <LegalPageTemplate slug={SLUG} label="Accessibility Statement" />;
}
