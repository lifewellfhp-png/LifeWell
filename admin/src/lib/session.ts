/**
 * Shared by middleware (Edge runtime) and the auth/proxy route handlers
 * (Node runtime) — keep this file free of runtime-specific imports (no
 * next/headers, no Node-only APIs) so both can import it safely.
 */

/** httpOnly session cookie holding the admin JWT. Never readable from client JS. */
export const SESSION_COOKIE = 'lw_admin_session';

/** The real Express API this app proxies admin requests to, server-side only. */
export const EXPRESS_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lifewellfhp-server.vercel.app';

/**
 * Matches the JWT's own expiresIn ('30d', server/src/middleware/adminAuth.ts)
 * so the cookie never outlives the token it holds. Phase 1 item 4 will
 * shorten both together (8h absolute / 30min idle) in a separate commit.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    // Secure cookies are refused by browsers over plain http://localhost —
    // only require it in production, where the app is always served over
    // https.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

/**
 * Shared with the server (same value in both Vercel projects). Proves to
 * Express that a declared client IP genuinely came through this proxy —
 * see server/src/middleware/index.ts's trustedClientIp(). Never forward the
 * browser's own x-forwarded-for/x-real-ip verbatim: Express can't tell
 * "this arrived via the admin proxy's trusted hop" apart from "a direct
 * caller forged this to impersonate that," so an unauthenticated raw
 * passthrough would let anyone bypass IP-keyed rate limiting by just
 * sending their own x-forwarded-for.
 */
const CLIENT_IP_HEADER = 'x-lifewell-client-ip';
const PROXY_SECRET_HEADER = 'x-lifewell-proxy-secret';

/**
 * This app runs on Vercel, so Vercel's own edge is what actually set these
 * headers for this request — trustworthy for *this* hop, same reasoning as
 * server/src/app.ts's `trust proxy: 1`. x-real-ip (a single value) is
 * preferred when present; x-forwarded-for's last entry otherwise (Vercel
 * appends its own determination after client-supplied hops, mirroring how
 * `trust proxy: 1` reads it on the server side).
 */
function extractClientIp(request: Request): string | null {
  const realIp = request.headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) return null;
  const parts = forwardedFor
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

/**
 * Preserves the real visitor IP across the proxy hop via a private,
 * secret-gated header — never the raw x-forwarded-for/x-real-ip (see
 * ADMIN_PROXY_SECRET's doc comment above). Without this, every proxied
 * request would appear to Express as coming from Vercel's own
 * infrastructure, silently defeating IP-keyed rate limiting
 * (adminLoginLimiter, changePasswordLimiter) on the upstream API. Returns
 * no headers at all if ADMIN_PROXY_SECRET isn't configured or no client IP
 * could be determined — Express then falls back to its own req.ip, same as
 * if this feature didn't exist.
 */
export function trustedClientIpHeaders(request: Request): HeadersInit {
  // Read per-call, not a module-level const — must reflect the real env at
  // call time (also makes this correctly testable without a fresh import).
  const secret = process.env.ADMIN_PROXY_SECRET;
  if (!secret) return {};
  const clientIp = extractClientIp(request);
  if (!clientIp) return {};
  return {
    [CLIENT_IP_HEADER]: clientIp,
    [PROXY_SECRET_HEADER]: secret,
  };
}
