/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  devIndicators: false,

  // Baseline security headers (P4-B1). CSP is deliberately deferred — it
  // needs its own pass over every script/resource this app loads.
  async headers() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'https://lifewellfhp-server.vercel.app';

    // P4-E4, Stage 1 of the P4-E2 rollout plan: observe-only. Deliberately
    // broad on script-src/style-src for now (no nonce middleware exists
    // yet — that's a later stage) so this can't itself break anything;
    // the point of this stage is to collect real violation reports before
    // tightening. See P4-E2's resource inventory for where every directive
    // below comes from.
    const cspReportOnly = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data: blob:",
      "font-src 'self'",
      `connect-src 'self' ${apiOrigin}`,
      'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'report-uri /api/csp-report',
    ].join('; ');

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
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
