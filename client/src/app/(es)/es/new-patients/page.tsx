import type { Metadata } from 'next';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { pageMetadata } from '@/lib/seo';
import { getResolvedContent } from '@/lib/cms-resolve';
import { newPatientsEs } from '@/data/es/new-patients';

const DESCRIPTION =
  'Aprende qué esperar en tu primera visita a LifeWell. Telesalud en FL, MA y AZ, o atención en persona en Orlando.';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Nuevos Pacientes: Qué Esperar | LifeWell',
    description: DESCRIPTION,
    path: '/es/new-patients',
    ogLocale: 'es_US',
    alternateLocale: { en: '/new-patients' },
  });
}

/** [REVIEW]: Spanish copy in data/es/new-patients.ts needs a native-speaker check. */
export default async function NewPatientsPageEs() {
  const cms = await getResolvedContent();

  return (
    <Section tone="base" spacing="lg">
      <Container size="narrow">
        <SectionHeading title={newPatientsEs.heading} description={newPatientsEs.intro} align="center" />

        <div className="mt-10">
          <h2 className="font-heading text-[22px] font-normal text-[var(--lw-primary)]">
            {newPatientsEs.beforeVisitHeading}
          </h2>
          <ul className="mt-4 space-y-2 text-[15px] text-text-secondary">
            {newPatientsEs.beforeVisitItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <h2 className="font-heading text-[22px] font-normal text-[var(--lw-primary)]">
            {newPatientsEs.whatToExpectHeading}
          </h2>
          <p className="mt-3 text-[15px] text-text-secondary">{newPatientsEs.whatToExpectBody}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h3 className="font-heading text-[18px] font-medium text-[var(--lw-primary)]">
              {newPatientsEs.telehealthHeading}
            </h3>
            <p className="mt-2 text-[14px] text-text-secondary">{newPatientsEs.telehealthBody}</p>
          </div>
          <div>
            <h3 className="font-heading text-[18px] font-medium text-[var(--lw-primary)]">
              {newPatientsEs.inPersonHeading}
            </h3>
            <p className="mt-2 text-[14px] text-text-secondary">{newPatientsEs.inPersonBody}</p>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <SwapButton href={cms.booking.page} trackAs="booking_click">
            Reservar una Cita
          </SwapButton>
        </div>
      </Container>
    </Section>
  );
}
