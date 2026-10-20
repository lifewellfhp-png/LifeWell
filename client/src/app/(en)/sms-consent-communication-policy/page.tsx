import type { Metadata } from 'next';
import { LegalPageTemplate, getLegalPage } from '@/components/sections/LegalPageTemplate';
import { cmsMetadata } from '@/lib/cms-seo';
import { getResolvedContent } from '@/lib/cms-resolve';

const SLUG = 'sms-consent-communication-policy';
const page = getLegalPage(SLUG);

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'SMS Consent Policy | LifeWell Mental Health Practice',
    description:
      page?.seoDescription ??
      page?.intro[0]?.slice(0, 158) ??
      'SMS Consent Policy for LifeWell Family Health & Psychiatry.',
    path: `/${SLUG}`,
  });
}

export default function Page() {
  return <LegalPageTemplate slug={SLUG} label="SMS Consent Policy" />;
}
