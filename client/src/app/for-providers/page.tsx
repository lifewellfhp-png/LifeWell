import type { Metadata } from 'next';

import { ForProvidersPageContent } from '@/components/sections/ReferralPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageGraph } from '@/lib/schema';
import { pageMetadata } from '@/lib/seo';

const PATH = '/for-providers';
const TITLE = 'For Providers | Refer Patients to LifeWell Psychiatry';
const DESCRIPTION =
  'Refer patients to LifeWell for outpatient psychiatric care by telehealth in FL, MA, and AZ or in person in Orlando. We contact patients within 1 business day.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default function ForProvidersPage() {
  return (
    <>
      <JsonLd
        data={pageGraph(PATH, 'For Providers', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'For Providers', href: PATH },
        ])}
        id="for-providers-schema"
      />
      <ForProvidersPageContent />
    </>
  );
}
