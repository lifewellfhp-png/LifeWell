import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container, Section } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageGraph } from '@/lib/schema';
import { pageMetadata } from '@/lib/seo';
import { telehealthStateSlugs } from '@/data/telehealth-states';
import { getResolvedContent } from '@/lib/cms-resolve';
import { telehealthStateLabelsEs } from '@/data/es/telehealth-states';

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
  const labels = telehealthStateLabelsEs[slug];
  if (!state || !labels) return {};

  return pageMetadata({
    title: `${labels.heading} | LifeWell`,
    description: `Evaluaciones psiquiátricas y manejo de medicamentos por telesalud para residentes de ${state.name}.`,
    path: `/es/telehealth/${slug}`,
    ogLocale: 'es_US',
    alternateLocale: { en: `/telehealth/${slug}` },
  });
}

/**
 * [REVIEW]: Spanish copy in data/es/telehealth-states.ts needs a
 * native-speaker check. Reads live cms.telehealthStates for pricing/
 * eligibility facts (never duplicated in Spanish, so they can't drift)
 * — only the surrounding labels are static Spanish text. Uses the
 * generic pageGraph() rather than telehealthStateGraph() (which hardcodes
 * /telehealth/ paths) — the per-state Service/FAQPage schema that
 * function emits was out of scope to parameterize for Spanish in this
 * pass, noted in the final report.
 */
export default async function TelehealthStatePageEs({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state: slug } = await params;
  const cms = await getResolvedContent();
  const state = cms.telehealthStates.find((s) => s.slug === slug);
  const labels = telehealthStateLabelsEs[slug];
  if (!state || !labels) notFound();

  const pricing = cms.fees.psychiatricStatePricing.find((p) => p.state === state.name);

  return (
    <>
      <JsonLd
        data={pageGraph(
          `/es/telehealth/${slug}`,
          labels.heading,
          `Telesalud en ${state.name}`,
          [
            { name: 'Inicio', href: '/es' },
            { name: state.name, href: `/es/telehealth/${slug}` },
          ],
          'es'
        )}
        id={`es-telehealth-${slug}-schema`}
      />

      <Section tone="base" spacing="lg">
        <Container size="narrow">
          <h1 className="text-center font-heading text-[28px] font-normal text-[var(--lw-primary)] desktop:text-[38px]">
            {labels.heading}
          </h1>
          <p className="mt-4 text-center text-[15px] text-text-secondary">{labels.selfPayOnlyNote}</p>

          {pricing && (
            <div className="mx-auto mt-8 max-w-sm rounded-[20px] bg-surface-raised p-6 text-center shadow-sm">
              <dl className="space-y-2 text-[15px]">
                <div className="flex justify-between">
                  <dt>Evaluación inicial</dt>
                  <dd className="font-semibold">${pricing.initialFee}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Seguimiento</dt>
                  <dd className="font-semibold">${pricing.followUpFee}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <SwapButton href={cms.booking.page} trackAs="booking_click">
              {labels.cta}
            </SwapButton>
          </div>
        </Container>
      </Section>
    </>
  );
}
