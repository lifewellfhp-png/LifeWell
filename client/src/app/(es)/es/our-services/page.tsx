import type { Metadata } from 'next';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { pageMetadata } from '@/lib/seo';
import { servicesEs } from '@/data/es/homepage';

const DESCRIPTION =
  'Evaluaciones psiquiátricas, manejo de medicamentos, atención primaria y consejería de bienestar. Telesalud en FL, MA y AZ; en persona en Orlando.';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Nuestros Servicios de Salud Mental | LifeWell',
    description: DESCRIPTION,
    path: '/es/our-services',
    ogLocale: 'es_US',
    alternateLocale: { en: '/our-services' },
  });
}

/**
 * [REVIEW]: Spanish copy needs a native-speaker check. This page shows
 * the same 4 featured services as the Spanish homepage (data/es/
 * homepage.ts) rather than the full English catalog (~11 services) —
 * translating every individual service page was out of scope for this
 * pass; noted in the final report as a follow-up. The full list is
 * still reachable via the English site through the language switcher.
 */
export default function OurServicesPageEs() {
  return (
    <Section tone="base" spacing="lg">
      <Container>
        <SectionHeading title="Nuestros Servicios" description={DESCRIPTION} align="center" />
        <ul className="mt-10 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {servicesEs.map((service) => (
            <li key={service.title} className="rounded-[20px] bg-surface-raised p-6 shadow-sm">
              <h3 className="font-heading text-[20px] font-medium italic text-[var(--lw-primary)]">
                {service.title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.5] text-text-secondary">{service.description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-[13px] text-text-secondary">
          ¿Buscas más detalles sobre un servicio específico? Visita nuestro sitio en inglés o contáctanos
          directamente.
        </p>
        <div className="mt-6 flex justify-center">
          <SwapButton href="/es/contact-telehealth-mental-health-provider">Contáctanos</SwapButton>
        </div>
      </Container>
    </Section>
  );
}
