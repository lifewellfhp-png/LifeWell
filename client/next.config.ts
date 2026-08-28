import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    // Admin CMS edits must show on the next request — do not keep RSC payloads.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },

  images: {
    // All imagery is served locally from /public — no remote patterns needed.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 200, 256, 320, 384],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },

  // Clean aliases -> canonical WordPress-era URLs. The original slugs are kept
  // as the real routes so existing search rankings and inbound links survive.
  async redirects() {
    return [
      { source: '/about', destination: '/bio', permanent: true },
      { source: '/contact', destination: '/contact-telehealth-mental-health-provider', permanent: true },
      { source: '/book', destination: '/book-telehealth-mental-health-appointment', permanent: true },
      { source: '/testimonials', destination: '/telehealth-mental-health-testimonials', permanent: true },
      { source: '/reviews', destination: '/telehealth-mental-health-testimonials', permanent: true },
      { source: '/faq', destination: '/faqs', permanent: true },
      { source: '/services-overview', destination: '/our-services', permanent: true },

      // Retired WooCommerce surface (was an indexable soft-404 on the old site).
      { source: '/shop', destination: '/', permanent: true },
      { source: '/cart', destination: '/', permanent: true },
      { source: '/checkout', destination: '/', permanent: true },
      { source: '/my-account', destination: '/', permanent: true },

      // Empty taxonomy carried over from the WordPress install.
      { source: '/category/uncategorized', destination: '/blog', permanent: true },

      // Resource Hub CMS migration: these 3 articles moved from static
      // root-level routes into the CMS-backed /blog/[slug] route. Redirecting
      // (rather than dropping the old route) preserves any indexed links or
      // bookmarks at the original URL with a single canonical destination.
      {
        source: '/understanding-anxiety-symptoms-and-when-to-seek-help',
        destination: '/blog/understanding-anxiety-symptoms-and-when-to-seek-help',
        permanent: true,
      },
      {
        source: '/adult-adhd-what-to-know-about-evaluation-and-treatment',
        destination: '/blog/adult-adhd-what-to-know-about-evaluation-and-treatment',
        permanent: true,
      },
      {
        source: '/what-happens-during-a-psychiatric-evaluation',
        destination: '/blog/what-happens-during-a-psychiatric-evaluation',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
