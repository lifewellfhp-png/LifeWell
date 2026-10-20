import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ServicePageContent } from '@/components/sections/ServicePageContent';
import { JsonLd } from '@/components/seo/JsonLd';

import { getService } from '@/data/services';
import { getServiceSummary, serviceSlugs } from '@/data/service-catalog';
import { cmsMetadata } from '@/lib/cms-seo';
import { serviceGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

export function generateStaticParams() {
  return serviceSlugs.map((slug) => ({ slug }));
}

/** CMS can add new service slugs after build. */
export const dynamicParams = true;
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cms = await getResolvedContent();
  const summary = cms.serviceSummaries.find((s) => s.slug === slug) || getServiceSummary(slug);
  const service = getService(slug);
  const detail = cms.serviceDetails.find((s) => s.slug === slug);
  if (!service && !summary) return {};

  const text = detail?.seoDescription || summary?.description || '';
  const description = text.length > 158 ? `${text.slice(0, 155).trimEnd()}…` : text;

  return cmsMetadata(cms, {
    title: detail?.seoTitle || `${summary?.title || service?.title} | Telehealth`,
    description,
    path: `/services/${slug}`,
    image: summary
      ? {
          url: summary.image.src,
          width: summary.image.width,
          height: summary.image.height,
          alt: summary.image.alt,
        }
      : undefined,
  });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cms = await getResolvedContent();
  const summary = cms.serviceSummaries.find((s) => s.slug === slug) || getServiceSummary(slug);
  const service = getService(slug);
  if (!service && !summary) notFound();

  const description = summary?.description ?? '';

  return (
    <>
      {service ? <JsonLd data={serviceGraph(service, description)} id={`service-${slug}-schema`} /> : null}
      <ServicePageContent slug={slug} />
    </>
  );
}
