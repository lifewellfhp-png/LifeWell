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
 * Preserves the real visitor IP across the proxy hop. Without this, every
 * proxied request would appear to Express as coming from Vercel's own
 * infrastructure, silently defeating IP-keyed rate limiting (adminLoginLimiter,
 * changePasswordLimiter) on the upstream API.
 */
export function forwardedForHeaders(request: Request): HeadersInit {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const headers: Record<string, string> = {};
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  if (realIp) headers['x-real-ip'] = realIp;
  return headers;
}
