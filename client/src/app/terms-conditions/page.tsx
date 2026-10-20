import type { Metadata } from 'next';
import { LegalPageTemplate, getLegalPage } from '@/components/sections/LegalPageTemplate';
import { cmsMetadata } from '@/lib/cms-seo';
import { getResolvedContent } from '@/lib/cms-resolve';

const SLUG = 'terms-conditions';
const page = getLegalPage(SLUG);

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Terms & Conditions | LifeWell Mental Health Practice',
    description:
      page?.seoDescription ??
      page?.intro[0]?.slice(0, 158) ??
      'Terms & Conditions for LifeWell Family Health & Psychiatry.',
    path: `/${SLUG}`,
    alternateLocale: { es: `/es/${SLUG}` },
  });
}

export default function Page() {
  return <LegalPageTemplate slug={SLUG} label="Terms & Conditions" />;
}
