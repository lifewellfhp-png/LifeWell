import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

/**
 * Nonce-based Content-Security-Policy header (P4-G3F; enforced — Stage 5 of
 * the P4-G3C design, following Report-Only rollout in P4-G3D and Preview
 * verification in P4-G3E). Generates one cryptographically random nonce per
 * request so script-src can drop 'unsafe-inline' in favor of
 * 'nonce-{value}' 'strict-dynamic' — Next.js auto-applies the nonce to its
 * own framework/page scripts once it can read it from the request's CSP
 * header (verified against the installed 15.5.23 package, not assumed from
 * newer-version docs). Safe here (unlike the public client app) because
 * admin's pages are effectively all dynamic — an authenticated CMS
 * dashboard has no reason to be statically prerendered, so there's no
 * build-time HTML that could ever carry a stale/mismatched nonce.
 *
 * Also verifies the admin session before rendering any page except /login
 * (Phase 1 item 3) — previously this middleware only set headers and never
 * looked at auth at all; the only real gate was a client-side redirect in
 * AdminShell.tsx, which an unauthenticated request for the page HTML itself
 * never had to pass. Browser calls to the Express API no longer happen
 * directly (see app/api/[...path]/route.ts) — connect-src is 'self' only.
 *
 * Also refreshes the session cookie's idle timeout on every successful page
 * load (Phase 1 item 4) — re-sets the same token with a fresh 30-minute
 * Max-Age, sliding the idle window forward. The absolute 8h cap is enforced
 * separately and cryptographically by the JWT's own exp claim, which this
 * never touches or extends.
 *
 * Runs on the Edge Runtime, so nonce generation avoids Buffer (not present
 * in Next's compiled edge runtime) in favor of Web Crypto + btoa. jose is
 * used for JWT verification (not jsonwebtoken, which needs Node's crypto
 * module and doesn't run on Edge).
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

const PUBLIC_PATHS = ['/login'];

/**
 * Signature + expiry only (no token_version/revocation check — that needs a
 * database round-trip and stays the API layer's job, via requireAdmin on
 * every actual data request forwarded through the proxy). This is a fast,
 * no-network gate: it can't be bypassed to view page HTML without a validly
 * signed, unexpired token, which is the gap this item exists to close — but
 * a revoked-but-unexpired token can still reach page shells (never real
 * data) until its signature-level expiry. Fails closed if ADMIN_JWT_SECRET
 * is missing.
 */
async function validatedSessionToken(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return null;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return token;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'report-uri /api/csp-report',
  ].join('; ');

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  let sessionToken: string | null = null;
  if (!isPublic) {
    sessionToken = await validatedSessionToken(request);
    if (!sessionToken) {
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set('Content-Security-Policy', csp);
      return response;
    }
  }

  // Set on the forwarded request so Next.js's SSR nonce parser can read it
  // (it inspects the incoming request's CSP header, not just the response).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // And on the response so the browser actually receives it.
  response.headers.set('Content-Security-Policy', csp);

  // Idle-timeout slide: same token, fresh 30-minute Max-Age. Only on
  // protected pages with a validated session — /login itself has none to
  // refresh, and never-authenticated requests have nothing to slide.
  if (sessionToken) {
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  }

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
