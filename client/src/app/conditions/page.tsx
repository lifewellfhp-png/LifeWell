import type { Metadata } from 'next';

import { ConditionsIndexContent } from '@/components/sections/ConditionPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageGraph } from '@/lib/schema';
import { pageMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Plain-language information about ADHD, anxiety, depression, bipolar disorder, and PTSD care for patients age 12+ in Orlando and by telehealth.';

export const metadata: Metadata = pageMetadata({
  title: 'Psychiatric Conditions We Treat in Orlando',
  description: DESCRIPTION,
  path: '/conditions',
});

export default function ConditionsPage() {
  return (
    <>
      <JsonLd
        data={pageGraph('/conditions', 'Psychiatric Conditions We Treat', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'Conditions', href: '/conditions' },
        ])}
        id="conditions-schema"
      />
      <ConditionsIndexContent />
    </>
  );
}
