import type { Metadata, Viewport } from 'next';
import { Lora, Source_Sans_3 } from 'next/font/google';
import '@/styles/globals.css';

import { site } from '@/data/site';
import { FooterEs } from '@/components/layout/FooterEs';
import { SkipLink } from '@/components/layout/SkipLink';
import { NavigationProgress } from '@/components/layout/NavigationProgress';
import { ThemeVars } from '@/components/layout/ThemeVars';
import { HeaderEs } from '@/components/layout/HeaderEs';
import { JsonLd } from '@/components/seo/JsonLd';
import { AnalyticsBeacon } from '@/components/seo/AnalyticsBeacon';
import { ChatAssistant } from '@/components/chat/ChatAssistant';
import { homeGraph } from '@/lib/schema';
import { DEFAULT_OG_IMAGE, withBrand } from '@/lib/seo';
import { getResolvedContent } from '@/lib/cms-resolve';

/* Same fonts as the English root layout (app/(en)/layout.tsx) — this is
   one design system, not two. next/font dedupes a font loaded with
   identical config in both files, so this doesn't double-ship assets. */
const lora = Lora({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600', '700'],
  variable: '--font-source-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: withBrand('Atención Psiquiátrica por Telesalud | Terapia y Manejo de Medicamentos'),
  description:
    'Atención compasiva de salud mental y atención primaria de un profesional certificado. Telesalud en FL, MA y AZ, o en persona en Orlando.',
  applicationName: site.name,
  authors: [{ name: 'Lourdie Chachoute, PMHNP-BC' }],
  creator: site.name,
  publisher: site.name,
  formatDetection: { telephone: true, address: false, email: true },
  alternates: { canonical: '/es' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: 'es_US',
    url: `${site.url}/es`,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: { card: 'summary_large_image' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#002574',
  colorScheme: 'light',
};

/**
 * Spanish root layout — a SEPARATE root (its own <html>) from
 * app/(en)/layout.tsx, per Next's documented multiple-root-layouts
 * pattern (see the Part 3 routing decision in the project's plan). This
 * is the only way to get <html lang="es"> correct here while
 * app/(en)/layout.tsx keeps <html lang="en-US"> for every English page,
 * under one shared root layout.tsx that can only ever emit one language.
 *
 * [REVIEW]: every Spanish string in this file and in HeaderEs.tsx/
 * FooterEs.tsx needs a native-speaker check before this ships — see the
 * final report's [REVIEW] list.
 */
export default async function SpanishRootLayout({ children }: { children: React.ReactNode }) {
  const cms = await getResolvedContent();

  return (
    <html lang="es" className={`${lora.variable} ${sourceSans.variable}`}>
      <body>
        <JsonLd data={homeGraph()} id="site-schema-es" />
        <ThemeVars />
        <SkipLink />
        <NavigationProgress />
        <HeaderEs logoUrl={cms.settings.logoUrl} />
        <main id="main-content" tabIndex={-1} className="min-w-0 overflow-x-clip focus:outline-none">
          {children}
        </main>
        <FooterEs />
        <AnalyticsBeacon />
        <ChatAssistant
          psychiatricStatePricing={cms.fees.psychiatricStatePricing}
          bookingUrl={cms.booking.page}
          localeNote="Nuestro asistente de chat responde actualmente en inglés."
        />
      </body>
    </html>
  );
}

