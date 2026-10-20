import type { Metadata } from 'next';
import { LegalNoticeEs } from '@/components/sections/LegalNoticeEs';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Política de Privacidad | LifeWell',
    description: 'Cómo protegemos tu información personal y de salud. El texto completo está disponible en inglés.',
    path: '/es/privacy-policy',
    ogLocale: 'es_US',
    alternateLocale: { en: '/privacy-policy' },
    noIndex: true,
  });
}

/** [REVIEW]: Spanish copy needs a native-speaker check. */
export default function PrivacyPolicyEs() {
  return (
    <LegalNoticeEs
      title="Política de Privacidad"
      summary="Protegemos tu información personal y de salud de acuerdo con las leyes aplicables. Recopilamos solo la información necesaria para brindarte atención, y nunca la vendemos."
      englishHref="/privacy-policy"
    />
  );
}
