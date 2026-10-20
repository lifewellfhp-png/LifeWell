import type { Metadata } from 'next';
import { LegalNoticeEs } from '@/components/sections/LegalNoticeEs';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Política de Consentimiento de SMS | LifeWell',
    description: 'Cómo usamos los mensajes de texto para recordatorios de citas. El texto completo está disponible en inglés.',
    path: '/es/sms-consent-communication-policy',
    ogLocale: 'es_US',
    alternateLocale: { en: '/sms-consent-communication-policy' },
    noIndex: true,
  });
}

/**
 * [REVIEW]: Spanish copy needs a native-speaker check. The Good Faith
 * Estimate notice, if one is added to this policy later, must NOT be
 * machine-translated without being explicitly marked — see the final
 * report.
 */
export default function SmsConsentPolicyEs() {
  return (
    <LegalNoticeEs
      title="Política de Consentimiento de SMS"
      summary="Al proporcionar tu número de teléfono, aceptas recibir mensajes de texto relacionados con recordatorios de citas y comunicación del servicio. Puedes cancelar la suscripción en cualquier momento."
      englishHref="/sms-consent-communication-policy"
    />
  );
}
