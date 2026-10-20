import type { Metadata } from 'next';
import { Container, Section } from '@/components/ui/Section';
import { BookingCalendar } from '@/components/sections/BookingCalendar';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageGraph } from '@/lib/schema';
import { pageMetadata } from '@/lib/seo';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Programa una cita confidencial y personalizada por telesalud con un profesional certificado.';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Reservar una Cita por Telesalud | LifeWell',
    description: DESCRIPTION,
    path: '/es/book-telehealth-mental-health-appointment',
    ogLocale: 'es_US',
    alternateLocale: { en: '/book-telehealth-mental-health-appointment' },
  });
}

/**
 * [REVIEW]: Spanish copy needs a native-speaker check. BookingCalendar
 * below is reused as-is — its own labels ("Choose a time...") stay
 * English, same scoped-reuse decision as the Spanish contact page's
 * ContactForm. The actual booking widget (the CharmHealth embed) is
 * fully functional regardless of language, satisfying item 15's
 * requirement; translating this component's surrounding text is a
 * follow-up noted in the final report.
 */
export default async function BookPageEs() {
  const cms = await getResolvedContent();

  return (
    <>
      <JsonLd
        data={pageGraph(
          '/es/book-telehealth-mental-health-appointment',
          'Reservar una Cita',
          DESCRIPTION,
          [
            { name: 'Inicio', href: '/es' },
            { name: 'Reservar una Cita', href: '/es/book-telehealth-mental-health-appointment' },
          ],
          'es'
        )}
        id="es-booking-schema"
      />

      <Section tone="base" spacing="lg">
        <Container size="narrow">
          <h1 className="text-center font-heading text-[30px] font-normal text-[var(--lw-primary)] desktop:text-[42px]">
            Reservar una Cita
          </h1>
          <p className="mt-4 text-center text-[15px] text-text-secondary">{DESCRIPTION}</p>
        </Container>
      </Section>

      <BookingCalendar src={cms.booking.url} />
    </>
  );
}
