import type { Metadata } from 'next';

import { FaqsPageContent } from '@/components/sections/FaqsPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { cmsMetadata } from '@/lib/cms-seo';
import { faqGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

/**
 * The source site published this page with the Privacy Policy's <title> and
 * meta description verbatim. Both are unique here.
 */
const DESCRIPTION =
  'Answers to common questions about telehealth mental health care — how appointments work, insurance and fees, confidentiality, what you need for a visit, and rescheduling.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Frequently Asked Questions — Telehealth Mental Health Care',
    description: DESCRIPTION,
    path: '/faqs',
  });
}

export default async function FaqsPage() {
  const cms = await getResolvedContent();

  return (
    <>
      <JsonLd data={faqGraph(cms.faqs, DESCRIPTION)} id="faq-schema" />
      <FaqsPageContent faqs={cms.faqs} />
    </>
  );
}
