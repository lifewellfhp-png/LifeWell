import type { Metadata } from 'next';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { SwapButton, OutlineButton } from '@/components/ui/SwapButton';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageMetadata } from '@/lib/seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';
import { formatCareLanguagesEs } from '@/data/site';
import { heroEs, servicesEs, howItWorksEs, insuranceEs } from '@/data/es/homepage';

const DESCRIPTION =
  'Atención compasiva de salud mental y atención primaria por telesalud en Florida, Massachusetts y Arizona, o en persona en Orlando.';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Atención de Salud Mental en Orlando y Telesalud | LifeWell',
    description: DESCRIPTION,
    path: '/es',
    ogLocale: 'es_US',
    alternateLocale: { en: '/' },
  });
}

/**
 * Spanish homepage. [REVIEW]: every Spanish string here (and in
 * data/es/homepage.ts) needs a native-speaker check before this ships.
 *
 * Deliberately simpler than the English homepage (app/(en)/page.tsx),
 * which assembles 8 CMS-driven section components — those read English
 * CMS content directly with no Spanish override plumbed in yet (see the
 * final report's scope notes). This page uses static Spanish copy for
 * this pass; cms.booking/cms.fees are still read live since prices and
 * the booking link must never drift from the real, governed English
 * values — only descriptive text is static here.
 */
export default async function HomePageEs() {
  const cms = await getResolvedContent();

  return (
    <>
      <JsonLd data={pageGraph('/es', 'LifeWell Family Health & Psychiatry', DESCRIPTION)} id="es-home-schema" />

      <Section tone="inverse" spacing="lg" className="bg-[var(--lw-primary)]">
        <Container>
          <p className="mb-4 inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-2 text-[12px] font-medium text-white">
            {heroEs.badge}
          </p>
          <h1 className="max-w-[20ch] font-heading text-[32px] font-normal leading-[1.15] tracking-[-2px] text-white sm:max-desktop:text-[44px] desktop:text-[52px]">
            {heroEs.heading}
          </h1>
          <p className="mt-6 max-w-[55ch] text-[16px] leading-[1.5] text-white/90 desktop:text-[18px]">
            {heroEs.subheading}
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            <SwapButton href={cms.booking.page} trackAs="booking_click">
              Reservar una Cita
            </SwapButton>
            <OutlineButton href="/es/fees-insurance">Tarifas y Seguro</OutlineButton>
          </div>
          <p className="mt-6 text-[13px] text-white/80">{formatCareLanguagesEs()}</p>
        </Container>
      </Section>

      <Section tone="raised" aria-labelledby="es-services-heading">
        <Container>
          <SectionHeading
            title="Nuestros Servicios"
            description="Atención completa de salud mental y bienestar, adaptada a ti."
            id="es-services-heading"
            align="center"
          />
          <ul className="mt-10 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {servicesEs.map((service) => (
              <li key={service.title} className="rounded-[20px] bg-white p-6 shadow-sm">
                <h3 className="font-heading text-[20px] font-medium italic text-[var(--lw-primary)]">
                  {service.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.5] text-text-secondary">{service.description}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex justify-center">
            <SwapButton href="/es/our-services">Ver Todos los Servicios</SwapButton>
          </div>
        </Container>
      </Section>

      <Section tone="base" aria-labelledby="es-how-heading">
        <Container>
          <SectionHeading title={howItWorksEs.heading} id="es-how-heading" align="center" />
          <ol className="mt-10 grid list-none grid-cols-1 gap-8 sm:grid-cols-3">
            {howItWorksEs.steps.map((step, i) => (
              <li key={step.title}>
                <span className="font-heading text-[32px] font-normal text-brand-accent-strong">{i + 1}</span>
                <h3 className="mt-2 font-heading text-[20px] font-medium">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.5] text-text-secondary">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section tone="raised" aria-labelledby="es-insurance-heading">
        <Container size="narrow">
          <SectionHeading title={insuranceEs.heading} description={insuranceEs.body} id="es-insurance-heading" align="center" />
          <div className="mt-8 flex justify-center">
            <SwapButton href="/es/fees-insurance">Ver Tarifas y Seguro</SwapButton>
          </div>
        </Container>
      </Section>

      <Section tone="inverse" spacing="lg" className="bg-[var(--color-brand-accent-strong)]">
        <Container size="narrow">
          <div className="text-center">
            <h2 className="font-heading text-[28px] font-normal text-white desktop:text-[36px]">
              ¿Listo para comenzar?
            </h2>
            <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <SwapButton href={cms.booking.page} trackAs="booking_click">
                Reservar una Cita
              </SwapButton>
              <OutlineButton href="/es/contact-telehealth-mental-health-provider">Contáctanos</OutlineButton>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
