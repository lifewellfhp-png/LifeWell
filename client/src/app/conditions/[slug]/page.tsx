import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ConditionPageContent } from '@/components/sections/ConditionPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { CONDITION_PAGES, getConditionPage } from '@/data/condition-pages';
import { faqGraph, medicalConditionGraph } from '@/lib/schema';
import { pageMetadata } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return CONDITION_PAGES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const condition = getConditionPage(slug);
  if (!condition) return {};
  return pageMetadata({
    title: condition.title,
    description: condition.metaDescription,
    path: `/conditions/${condition.slug}`,
  });
}

export default async function ConditionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const condition = getConditionPage(slug);
  if (!condition) notFound();
  const path = `/conditions/${condition.slug}`;
  const trail = [
    { name: 'Home', href: '/' },
    { name: 'Conditions', href: '/conditions' },
    { name: condition.name, href: path },
  ];

  return (
    <>
      <JsonLd
        data={medicalConditionGraph(path, condition.title, condition.metaDescription, trail, condition.name)}
        id={`${condition.slug}-medical-schema`}
      />
      <JsonLd
        data={faqGraph(condition.faqs, condition.metaDescription, {
          path,
          pageName: condition.title,
          breadcrumb: trail,
        })}
        id={`${condition.slug}-faq-schema`}
      />
      <ConditionPageContent condition={condition} />
    </>
  );
}
