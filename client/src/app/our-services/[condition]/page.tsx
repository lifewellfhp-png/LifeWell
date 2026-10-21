import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHero } from '@/components/sections/PageHero';
import { JsonLd } from '@/components/seo/JsonLd';
import { SwapButton } from '@/components/ui/SwapButton';
import { getPsychiatricCondition, PSYCHIATRIC_CONDITIONS } from '@/data/psychiatric-conditions';
import { pageGraph } from '@/lib/schema';
import { pageMetadata } from '@/lib/seo';

export function generateStaticParams() {
  return PSYCHIATRIC_CONDITIONS.map(({ id }) => ({ condition: id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ condition: string }>;
}): Promise<Metadata> {
  const { condition } = await params;
  const entry = getPsychiatricCondition(condition);
  if (!entry) return {};

  return pageMetadata({
    title: `${entry.name} | Psychiatric Services`,
    description: entry.description,
    path: entry.canonicalPath,
  });
}

export default async function PsychiatricConditionPage({
  params,
}: {
  params: Promise<{ condition: string }>;
}) {
  const { condition } = await params;
  const entry = getPsychiatricCondition(condition);
  if (!entry) notFound();

  return (
    <>
      <PageHero
        eyebrow="Psychiatric Services"
        title={entry.name}
        lead={entry.description}
        breadcrumbs={[
          { name: 'Home', href: '/' },
          { name: 'Our Services', href: '/our-services' },
          { name: entry.name, href: entry.canonicalPath },
        ]}
      />
      <JsonLd
        data={pageGraph(entry.canonicalPath, entry.name, entry.description, [
          { name: 'Home', href: '/' },
          { name: 'Our Services', href: '/our-services' },
          { name: entry.name, href: entry.canonicalPath },
        ])}
        id={`${entry.id}-schema`}
      />

      <section className="bg-white px-5 py-14 sm:px-[30px] sm:py-20 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.1em] text-brand-primary-solid">
            About this condition
          </p>
          <p className="mt-4 text-lg leading-8 text-text-secondary">
            LifeWell provides individualized psychiatric evaluation and treatment planning.
            A complete assessment is needed to determine whether a condition is present and
            which care options are appropriate for you.
          </p>

          <div className="mt-10 rounded-md border border-border-subtle bg-surface-raised p-6">
            <h2 className="text-h4">At a glance</h2>
            <p className="mt-3 text-text-secondary">
              Reported prevalence: <strong>{entry.prevalence}</strong>
            </p>
            {entry.citations.length > 0 && (
              <p className="mt-2 text-sm text-text-secondary">
                References: {entry.citations.join(', ')}
              </p>
            )}
          </div>

          <div className="mt-10">
            <SwapButton href="/book-telehealth-mental-health-appointment#charm-calendar" trackAs="booking_click">
              Book an Appointment
            </SwapButton>
          </div>
        </div>
      </section>
    </>
  );
}
