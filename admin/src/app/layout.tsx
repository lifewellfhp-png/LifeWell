import type { Metadata, Viewport } from 'next';
import { Lora, Source_Sans_3 } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

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

// Required for nonce-based CSP (P4-G3D): Next.js applies nonces during
// per-request SSR, so every route sharing this root layout must be
// dynamically rendered rather than statically prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'LifeWell Admin',
  description: 'Website content and leads control center for LifeWell Family Health & Psychiatry.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2f6691',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${sourceSans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
