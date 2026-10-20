import type { Metadata } from 'next';

import { NewPatientsPageContent } from '@/components/sections/NewPatientsPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Learn what to expect at your first LifeWell visit, what to have ready, and how to prepare. Telehealth mental health care in FL, MA & AZ or in-person care in Orlando. Accepting new patients.';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'New Patients — What to Expect at Your First Visit',
    description: DESCRIPTION,
    path: '/new-patients',
  });
}

export default async function NewPatientsPage() {
  return (
    <>
      <JsonLd
        data={pageGraph('/new-patients', 'New Patients', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'New Patients', href: '/new-patients' },
        ])}
        id="new-patients-schema"
      />
      <NewPatientsPageContent />
    </>
  );
}
