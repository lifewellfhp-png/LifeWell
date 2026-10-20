import type { Metadata } from 'next';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { pageMetadata } from '@/lib/seo';
import { getResolvedContent } from '@/lib/cms-resolve';
import { feesEs, stateNamesEs } from '@/data/es/fees';

const DESCRIPTION =
  'Precios de pago directo y planes de seguro aceptados para salud mental y atención primaria. Telesalud en FL, MA y AZ.';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Tarifas y Seguro de Salud Mental | LifeWell',
    description: DESCRIPTION,
    path: '/es/fees-insurance',
    ogLocale: 'es_US',
    alternateLocale: { en: '/fees-insurance' },
  });
}

/**
 * [REVIEW]: Spanish copy in data/es/fees.ts needs a native-speaker
 * check, especially the sliding-scale line (marked [CONFIRM] there).
 * Prices themselves are read live from cms.fees — never duplicated or
 * re-typed in Spanish, so they can never drift from the governed
 * English figures.
 */
export default async function FeesInsurancePageEs() {
  const cms = await getResolvedContent();

  return (
    <>
      <Section tone="base" spacing="lg">
        <Container size="narrow">
          <SectionHeading title={feesEs.heading} description={feesEs.intro} align="center" />
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <h2 className="font-heading text-[26px] font-normal text-[var(--lw-primary)]">{feesEs.selfPayHeading}</h2>
          <p className="mt-2 text-[14px] text-text-secondary">{feesEs.selfPayNote}</p>
          <ul className="mt-8 grid list-none grid-cols-1 gap-6 sm:grid-cols-3">
            {cms.fees.psychiatricStatePricing.map((p) => (
              <li key={p.state} className="rounded-[20px] bg-white p-6 shadow-sm">
                <h3 className="font-heading text-[20px] font-medium text-[var(--lw-primary)]">
                  {stateNamesEs[p.state] ?? p.state}
                </h3>
                <p className="mt-3 text-[14px] text-text-secondary">
                  {p.selfPayOnly ? 'Solo pago directo (self-pay)' : 'Pago directo o seguro'}
                </p>
                <dl className="mt-4 space-y-1 text-[15px]">
                  <div className="flex justify-between">
                    <dt>Evaluación inicial</dt>
                    <dd className="font-semibold">${p.initialFee}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Seguimiento</dt>
                    <dd className="font-semibold">${p.followUpFee}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {cms.fees.otherSelfPayPricing.length > 0 && (
        <Section tone="base">
          <Container>
            <h2 className="font-heading text-[26px] font-normal text-[var(--lw-primary)]">
              {feesEs.otherServicesHeading}
            </h2>
            <ul className="mt-8 grid list-none grid-cols-1 gap-6 sm:grid-cols-2">
              {cms.fees.otherSelfPayPricing.map((tier) => (
                <li key={tier.name} className="rounded-[20px] bg-white p-6 shadow-sm">
                  <h3 className="font-heading text-[18px] font-medium text-[var(--lw-primary)]">{tier.name}</h3>
                  <dl className="mt-3 space-y-1 text-[15px]">
                    <div className="flex justify-between">
                      <dt>Inicial ({tier.initialDuration})</dt>
                      <dd className="font-semibold">${tier.initialFee}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Seguimiento ({tier.followUpDuration})</dt>
                      <dd className="font-semibold">${tier.followUpFee}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      <Section tone="raised">
        <Container size="narrow">
          <h2 className="font-heading text-[26px] font-normal text-[var(--lw-primary)]">{feesEs.insuranceHeading}</h2>
          <p className="mt-3 text-[15px] text-text-secondary">{feesEs.insuranceBody}</p>
          {cms.insurance.length > 0 && (
            <ul className="mt-6 grid list-none grid-cols-2 gap-3 sm:grid-cols-3">
              {cms.insurance.map((carrier) => (
                <li key={carrier.name} className="rounded-md bg-white px-4 py-3 text-center text-[14px] shadow-sm">
                  {carrier.name}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-[13px] text-text-secondary">{feesEs.insuranceDisclaimer}</p>
          <div className="mt-8 flex justify-center">
            <SwapButton href={cms.booking.page} trackAs="booking_click">
              Reservar una Cita
            </SwapButton>
          </div>
        </Container>
      </Section>
    </>
  );
}
