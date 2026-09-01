import { NextResponse, type NextRequest } from 'next/server';

/**
 * Nonce-based Content-Security-Policy header (P4-G3F; enforced — Stage 5 of
 * the P4-G3C design, following Report-Only rollout in P4-G3D and Preview
 * verification in P4-G3E). Generates one cryptographically random nonce per
 * request so script-src can drop 'unsafe-inline' in favor of
 * 'nonce-{value}' 'strict-dynamic' — Next.js auto-applies the nonce to its
 * own framework/page scripts once it can read it from the request's CSP
 * header (verified against the installed 15.5.23 package, not assumed from
 * newer-version docs).
 *
 * Runs on the Edge Runtime, so nonce generation avoids Buffer (not present
 * in Next's compiled edge runtime) in favor of Web Crypto + btoa.
 */

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'https://lifewellfhp-server.vercel.app';

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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

  // Set on the forwarded request so Next.js's SSR nonce parser can read it
  // (it inspects the incoming request's CSP header, not just the response).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // And on the response so the browser actually receives it.
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  // Every document/page request needs a nonce; only clearly non-document
  // paths are excluded (API routes, build assets, the favicon). Deliberately
  // does not add a prefetch-specific exclusion — that pattern is documented
  // for a newer Next.js version and its safety for 15.5.23 couldn't be
  // verified against this installed package, so it's omitted in favor of
  // covering every page path unconditionally.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
