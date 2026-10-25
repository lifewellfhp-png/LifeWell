import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
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
const lora = localFont({
  src: [
    { path: '../../public/fonts/lora-normal-400.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/lora-normal-500.ttf', weight: '500', style: 'normal' },
    { path: '../../public/fonts/lora-normal-600.ttf', weight: '600', style: 'normal' },
    { path: '../../public/fonts/lora-italic-400.ttf', weight: '400', style: 'italic' },
    { path: '../../public/fonts/lora-italic-500.ttf', weight: '500', style: 'italic' },
    { path: '../../public/fonts/lora-italic-600.ttf', weight: '600', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-lora',
});

const sourceSans = localFont({
  src: [
    { path: '../../public/fonts/source-sans-400.ttf', weight: '400' },
    { path: '../../public/fonts/source-sans-600.ttf', weight: '600' },
    { path: '../../public/fonts/source-sans-700.ttf', weight: '700' },
  ],
  display: 'swap',
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
  // Phase 24 homepage reorg: matches the new brand navy (globals.css's --lw-primary).
  themeColor: '#002574',
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cms = await getResolvedContent();

  return (
    <html lang="en-US" className={`${lora.variable} ${sourceSans.variable}`}>
      <body>
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
