import type { Metadata } from 'next';

import { PartnersPageContent } from '@/components/sections/ReferralPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageGraph } from '@/lib/schema';
import { pageMetadata } from '@/lib/seo';

const PATH = '/partners';
const TITLE = 'Partner with LifeWell | Organizational Mental Health Support';
const DESCRIPTION =
  'Partner with LifeWell to help employees and students access outpatient psychiatric care by telehealth or in person in Orlando.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default function PartnersPage() {
  return (
    <>
      <JsonLd
        data={pageGraph(PATH, 'Partners', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'Partners', href: PATH },
        ])}
        id="partners-schema"
      />
      <PartnersPageContent />
    </>
  );
}
