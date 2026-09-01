/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  devIndicators: false,

  // Baseline security headers (P4-B1). CSP moved to src/middleware.ts
  // (P4-G3D) so it can carry a fresh per-request nonce — do not add it back
  // here, that would produce two competing CSP Report-Only headers.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Admin has no legitimate reason to ever be framed by another
          // site (it embeds iframes itself for previews, but is never the
          // framed party) — DENY rather than the client's SAMEORIGIN.
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
