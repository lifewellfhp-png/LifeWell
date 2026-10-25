import type { Metadata } from 'next';

import { AvalonParkPageContent } from '@/components/sections/AvalonParkPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { localClinicGraph } from '@/lib/schema';
import { pageMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Psychiatric evaluations and medication management near Avalon Park in Orlando, with in-person care at 3680 Avalon Park E Blvd and telehealth options.';

export const metadata: Metadata = pageMetadata({
  title: 'Psychiatric Care Near Avalon Park | LifeWell',
  description: DESCRIPTION,
  path: '/psychiatric-care-avalon-park',
});

export default function AvalonParkPage() {
  return (
    <>
      <JsonLd
        data={localClinicGraph('/psychiatric-care-avalon-park', 'Psychiatric Care Near Avalon Park', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'Psychiatric Care Near Avalon Park', href: '/psychiatric-care-avalon-park' },
        ])}
        id="avalon-park-clinic-schema"
      />
      <AvalonParkPageContent />
    </>
  );
}
