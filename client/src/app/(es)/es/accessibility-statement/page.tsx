import type { Metadata } from 'next';
import { LegalNoticeEs } from '@/components/sections/LegalNoticeEs';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Declaración de Accesibilidad | LifeWell',
    description: 'Nuestro compromiso con la accesibilidad. El texto completo está disponible en inglés.',
    path: '/es/accessibility-statement',
    ogLocale: 'es_US',
    alternateLocale: { en: '/accessibility-statement' },
    noIndex: true,
  });
}

/** [REVIEW]: Spanish copy needs a native-speaker check. */
export default function AccessibilityStatementEs() {
  return (
    <LegalNoticeEs
      title="Declaración de Accesibilidad"
      summary="Nos esforzamos por hacer que nuestro sitio web y nuestros servicios sean accesibles e inclusivos para todos los pacientes."
      englishHref="/accessibility-statement"
    />
  );
}
