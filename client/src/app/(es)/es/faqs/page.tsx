import type { Metadata } from 'next';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageMetadata } from '@/lib/seo';
import { faqGraph } from '@/lib/schema';
import { faqsEs } from '@/data/es/faqs';

const DESCRIPTION =
  'Respuestas a preguntas comunes sobre citas, seguro, tarifas y qué esperar en tu primera visita.';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Preguntas Frecuentes de Pacientes | LifeWell',
    description: DESCRIPTION,
    path: '/es/faqs',
    ogLocale: 'es_US',
    alternateLocale: { en: '/faqs' },
  });
}

/** [REVIEW]: Spanish copy in data/es/faqs.ts needs a native-speaker check. */
export default function FaqsPageEs() {
  return (
    <>
      <JsonLd
        data={faqGraph([...faqsEs], DESCRIPTION, {
          path: '/es/faqs',
          pageName: 'Preguntas Frecuentes',
          language: 'es',
          breadcrumb: [
            { name: 'Inicio', href: '/es' },
            { name: 'Preguntas Frecuentes', href: '/es/faqs' },
          ],
        })}
        id="es-faqs-schema"
      />

      <Section tone="base" spacing="lg">
        <Container size="narrow">
          <SectionHeading title="Preguntas Frecuentes" description={DESCRIPTION} align="center" />
          <dl className="mt-10 space-y-6">
            {faqsEs.map((faq) => (
              <div key={faq.question} className="rounded-[16px] bg-surface-raised p-6">
                <dt className="font-heading text-[18px] font-medium text-[var(--lw-primary)]">{faq.question}</dt>
                <dd className="mt-2 text-[15px] leading-[1.5] text-text-secondary">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
    </>
  );
}
