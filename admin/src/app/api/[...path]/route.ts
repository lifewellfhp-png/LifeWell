import { NextResponse, type NextRequest } from 'next/server';
import {
  EXPRESS_API_URL,
  SESSION_COOKIE,
  trustedClientIpHeaders,
  protectionBypassHeaders,
  sessionCookieOptions,
} from '@/lib/session';

/**
 * Generic reverse proxy for every admin API call this app doesn't give its
 * own dedicated route handler (login/logout/change-password, which need to
 * touch the session cookie itself — see the sibling api/admin/auth/*
 * routes, matched first by Next's router since literal segments win over a
 * catch-all). This is what makes the httpOnly session cookie first-party:
 * the browser only ever calls this same-origin /api/* path, never the
 * Express origin directly, so the cookie is attached automatically and
 * never exposed to client JS.
 *
 * Streams the request/response body through unmodified (no JSON parsing),
 * so this covers every content type uniformly — JSON, multipart media
 * uploads, CSV exports — without special-casing any of them.
 */

const STATE_CHANGING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;

  // CSRF defense in depth: SameSite=Strict on the session cookie already
  // stops it being sent on cross-site requests, but this catches anything
  // that mechanism might miss (older browsers, same-site-but-unexpected
  // origins) for anything that actually changes state. Compared against
  // this request's own Host (same-origin), not a configured URL — works
  // identically on every Vercel preview and on production with zero config,
  // and a preview's distinct URL can never be mistaken for a different,
  // misconfigured "expected" origin. Missing Origin is rejected too, not
  // just a mismatched one — a same-origin browser request always sends one
  // for a state-changing fetch.
  if (STATE_CHANGING.has(request.method)) {
    const origin = request.headers.get('origin');
    const expectedOrigin = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    if (!origin || origin !== expectedOrigin) {
      return NextResponse.json({ success: false, message: 'Request origin not allowed.' }, { status: 403 });
    }
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  const upstreamHeaders = new Headers({ ...trustedClientIpHeaders(request), ...protectionBypassHeaders() });
  const contentType = request.headers.get('content-type');
  if (contentType) upstreamHeaders.set('Content-Type', contentType);
  if (token) upstreamHeaders.set('Authorization', `Bearer ${token}`);

  const upstreamUrl = `${EXPRESS_API_URL}/api/${path.join('/')}${request.nextUrl.search}`;
  const hasBody = !['GET', 'HEAD'].includes(request.method);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    body: hasBody ? request.body : undefined,
    // Required by Node's fetch/undici when streaming a request body.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get('content-type');
  if (upstreamContentType) responseHeaders.set('Content-Type', upstreamContentType);
  const disposition = upstream.headers.get('content-disposition');
  if (disposition) responseHeaders.set('Content-Disposition', disposition);
  const cacheControl = upstream.headers.get('cache-control');
  if (cacheControl) responseHeaders.set('Cache-Control', cacheControl);

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  // Idle-timeout slide (Phase 1 item 4): API-only activity (no intervening
  // page load) would otherwise never reset the idle clock, since middleware
  // never runs for /api/* paths at all. Only on an authenticated request
  // that actually succeeded — a 401 means the session is already invalid
  // (expired or revoked), and extending its cookie would be pointless.
  if (token && upstream.status !== 401) {
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  }

  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
