import type { Metadata } from 'next';

import { FeesPageContent } from '@/components/sections/FeesPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { feesIntro } from '@/data/pricing';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';

import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Transparent telehealth fees and insurance information — self-pay rates for mental health, primary care and weight management, plus accepted plans and superbill details.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Fees & Insurance — Transparent Telehealth Pricing',
    description: DESCRIPTION,
    path: '/fees-insurance',
    image: {
      url: feesIntro.image.src,
      width: feesIntro.image.width,
      height: feesIntro.image.height,
      alt: feesIntro.image.alt,
    },
  });
}

export default async function FeesInsurancePage() {
  const cms = await getResolvedContent();
  return (
    <>
      <JsonLd
        data={pageGraph('/fees-insurance', 'Fees & Insurance', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'Fees & Insurance', href: '/fees-insurance' },
        ])}
        id="fees-schema"
      />
      <FeesPageContent
        carriers={cms.insurance}
        faqs={cms.feesFaqs}
        bookingUrl={cms.booking.page}
        introHeading={cms.fees.introHeading}
        introBody={cms.fees.introBody}
        selfPayHeading={cms.fees.selfPayHeading}
        selfPayBody={cms.fees.selfPayBody}
        insuranceDisclaimer={cms.fees.insuranceDisclaimer}
      />
    </>
  );
}
