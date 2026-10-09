import type { Metadata, Viewport } from 'next';
import { Lora, Source_Sans_3 } from 'next/font/google';
import Script from 'next/script';
import '@/styles/globals.css';

import { site } from '@/data/site';
import { Footer } from '@/components/layout/Footer';
import { SkipLink } from '@/components/layout/SkipLink';
import { NavigationProgress } from '@/components/layout/NavigationProgress';
import { ThemeVars } from '@/components/layout/ThemeVars';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { JsonLd } from '@/components/seo/JsonLd';
import { AnalyticsBeacon } from '@/components/seo/AnalyticsBeacon';
import { ChatAssistant } from '@/components/chat/ChatAssistant';
import { homeGraph } from '@/lib/schema';
import { DEFAULT_OG_IMAGE, withBrand } from '@/lib/seo';
import { getResolvedContent } from '@/lib/cms-resolve';

/* Self-hosted via next/font — no runtime request to Google. Only the weights
   the design system actually uses are loaded. */
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
  // No `template` here — every page sets an explicit `title: { absolute }`
  // via lib/seo.ts's pageMetadata(), which brands the title exactly once
  // (see withBrand()). A template on this segment previously applied only
  // to routes other than the homepage (page.tsx shares this exact segment
  // with layout.tsx, so Next never applied the template to it), which is
  // what let CMS-entered titles already containing the brand name end up
  // double-branded everywhere except "/".
  title: withBrand('Telehealth Mental Health Care | PMHNP Online Therapy & Medication Management'),
  description: site.description,
  applicationName: site.name,
  authors: [{ name: 'Lourdie Chachoute, PMHNP-BC' }],
  creator: site.name,
  publisher: site.name,
  formatDetection: { telephone: true, address: false, email: true },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: site.locale,
    url: site.url,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: { card: 'summary_large_image' },
  // Icons resolve from app/icon.png and app/apple-icon.png via file convention.
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
  // Not capped — users must be able to zoom (WCAG 1.4.4).
  themeColor: '#3e7fb1',
  colorScheme: 'light',
};

/**
 * Google Ads conversion tracking only — gtag.js loaded directly, no GTM
 * container and no GA4. Renders only when NEXT_PUBLIC_GOOGLE_ADS_ID is set,
 * so an unconfigured environment loads no third-party script at all. This
 * is the root layout for the public app only (admin/ is a separate Next.js
 * app with its own layout) and has no reach into the cross-origin
 * CharmHealth booking iframe rendered on the booking page.
 */
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cms = await getResolvedContent();

  return (
    <html lang="en-US" className={`${lora.variable} ${sourceSans.variable}`}>
      <body>
        {GOOGLE_ADS_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-ads-gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', ${JSON.stringify(GOOGLE_ADS_ID)}, { allow_ad_personalization_signals: false });
              `}
            </Script>
          </>
        )}
        <JsonLd data={homeGraph()} id="site-schema" />
        <ThemeVars />
        <SkipLink />
        <NavigationProgress />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="min-w-0 overflow-x-clip focus:outline-none">
          {children}
        </main>
        <Footer />
        <AnalyticsBeacon />
        <ChatAssistant psychiatricStatePricing={cms.fees.psychiatricStatePricing} bookingUrl={cms.booking.page} />
      </body>
    </html>
  );
}
