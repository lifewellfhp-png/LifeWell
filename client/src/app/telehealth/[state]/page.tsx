import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TelehealthStatePageContent } from '@/components/sections/TelehealthStatePageContent';
import { JsonLd } from '@/components/seo/JsonLd';

import { getTelehealthState, telehealthStateSlugs } from '@/data/telehealth-states';
import { cmsMetadata } from '@/lib/cms-seo';
import { telehealthStateGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

export function generateStaticParams() {
  return telehealthStateSlugs.map((state) => ({ state }));
}

export const dynamicParams = false;
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state: slug } = await params;
  const state = getTelehealthState(slug);
  if (!state) return {};

  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: state.metaTitle,
    description: state.metaDescription,
    path: `/telehealth/${slug}`,
  });
}

export default async function TelehealthStatePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state: slug } = await params;
  const state = getTelehealthState(slug);
  if (!state) notFound();

  const cms = await getResolvedContent();

  return (
    <>
      <JsonLd
        data={telehealthStateGraph(state, state.metaDescription)}
        id={`telehealth-${slug}-schema`}
      />
      <TelehealthStatePageContent
        state={state}
        services={cms.serviceSummaries}
        bookingUrl={cms.booking.page}
        providerName={cms.provider?.name}
      />
    </>
  );
}
