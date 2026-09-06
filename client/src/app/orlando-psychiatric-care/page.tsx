import type { Metadata } from 'next';

import { OrlandoPageContent } from '@/components/sections/OrlandoPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Psychiatric evaluations and medication management in Orlando, FL — in person at our Avalon Park office or by secure telehealth. Accepting new patients.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Psychiatric Care in Orlando, FL — In Person or Telehealth',
    description: DESCRIPTION,
    path: '/orlando-psychiatric-care',
  });
}

export default async function OrlandoPage() {
  return (
    <>
      <JsonLd
        data={pageGraph('/orlando-psychiatric-care', 'Psychiatric Care in Orlando, FL', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'Orlando, FL', href: '/orlando-psychiatric-care' },
        ])}
        id="orlando-schema"
      />
      <OrlandoPageContent />
    </>
  );
}
