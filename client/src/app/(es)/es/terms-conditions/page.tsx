import type { Metadata } from 'next';
import { LegalNoticeEs } from '@/components/sections/LegalNoticeEs';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Términos y Condiciones | LifeWell',
    description: 'Términos de uso del sitio y de telesalud. El texto completo está disponible en inglés.',
    path: '/es/terms-conditions',
    ogLocale: 'es_US',
    alternateLocale: { en: '/terms-conditions' },
    noIndex: true,
  });
}

/** [REVIEW]: Spanish copy needs a native-speaker check. */
export default function TermsConditionsEs() {
  return (
    <LegalNoticeEs
      title="Términos y Condiciones"
      summary="Estos términos rigen el uso de este sitio web y de nuestros servicios de telesalud, incluyendo las responsabilidades del paciente y las políticas de la práctica."
      englishHref="/terms-conditions"
    />
  );
}
