import type { Metadata, Viewport } from 'next';
import { Lora, Source_Sans_3 } from 'next/font/google';
import '@/styles/globals.css';

import { site } from '@/data/site';
import { Footer } from '@/components/layout/Footer';
import { SkipLink } from '@/components/layout/SkipLink';
import { NavigationProgress } from '@/components/layout/NavigationProgress';
import { ThemeVars } from '@/components/layout/ThemeVars';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { JsonLd } from '@/components/seo/JsonLd';
import { AnalyticsBeacon } from '@/components/seo/AnalyticsBeacon';
import { homeGraph } from '@/lib/schema';
import { DEFAULT_OG_IMAGE, withBrand } from '@/lib/seo';

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

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Not capped — users must be able to zoom (WCAG 1.4.4).
  themeColor: '#3e7fb1',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
      </body>
    </html>
  );
}
