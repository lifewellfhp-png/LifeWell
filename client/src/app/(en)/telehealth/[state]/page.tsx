import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TelehealthStatePageContent } from '@/components/sections/TelehealthStatePageContent';
import { JsonLd } from '@/components/seo/JsonLd';

import { telehealthStateSlugs } from '@/data/telehealth-states';
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
  const cms = await getResolvedContent();
  const state = cms.telehealthStates.find((s) => s.slug === slug);
  if (!state) return {};

  const text = state.metaDescription || '';
  const description = text.length > 158 ? `${text.slice(0, 155).trimEnd()}…` : text;

  return cmsMetadata(cms, {
    title: state.metaTitle,
    description,
    path: `/telehealth/${slug}`,
    image: state.ogImageUrl || state.heroImage ? { url: (state.ogImageUrl || state.heroImage?.src) as string } : undefined,
  });
}

export default async function TelehealthStatePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state: slug } = await params;
  const cms = await getResolvedContent();
  const state = cms.telehealthStates.find((s) => s.slug === slug);
  if (!state) notFound();

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
      />
    </>
  );
}
