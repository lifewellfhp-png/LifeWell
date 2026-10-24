import { NextResponse, type NextRequest } from 'next/server';
import { englishPathForSpanishPath } from '@/lib/spanish-redirects';

/**
 * Content-Security-Policy for the public client app. Previously this app
 * had no CSP at all.
 *
 * Deliberately a STATIC policy, not a nonce-based one — most of this app's
 * routes are statically generated/ISR-cached (next build's ○/●), and a
 * nonce only ever exists at request time. A page prerendered at build time
 * can never contain a nonce matching a later per-request header, and under
 * 'strict-dynamic' that means 'self' is ignored for script-src — so a
 * nonce-based policy here would silently block every script on every
 * static page (confirmed empirically: on this app's static routes, 0 of
 * the rendered <script> tags carried any nonce attribute at all, vs. 100%
 * on the one already-dynamic route tested). 'unsafe-inline' is weaker
 * against an attacker who can inject markup into the page, but this app
 * has no user-generated-HTML rendering path (all content is CMS-authored
 * and already escaped — see lib/schema.ts's JSON-LD escaping, the
 * no-free-text-forms policy), so the realistic exposure is low, and it's
 * the only policy shape that doesn't break static rendering. The
 * nonce-based approach stays on admin (admin/src/middleware.ts) since
 * that app's pages are effectively all dynamic (an authenticated CMS
 * dashboard), where the nonce mechanism works correctly.
 *
 * Domains allowed beyond 'self':
 *  - CharmHealth (frame-src): the booking-page iframe (BookingCalendar.tsx).
 *  - youtube-nocookie.com / player.vimeo.com (frame-src): lazy video embeds
 *    (VideosSection.tsx / LazyEmbed.tsx).
 *  - The API origin (connect-src): first-party conversions/analytics beacon
 *    and the chat assistant both fetch() the Express API directly.
 *  - challenges.cloudflare.com (script-src + frame-src): the Turnstile
 *    widget on the contact/newsletter forms (Phase 1 item 7) — it loads a
 *    script and renders its own challenge inside an iframe.
 *  - www.google.com/maps/ and maps.google.com (frame-src only): the office
 *    location embed on the contact page (ContactPageContent.tsx). Narrowly
 *    scoped to just these two Maps embed hosts, not all of google.com.
 *
 * Deliberately NOT included yet: the Google Ads domains. That work lives on
 * the unmerged feature/google-ads-conversion-tracking branch, still pending
 * an activation decision — add them (img-src/connect-src/frame-src, and
 * script-src if gtag.js needs it under this static policy) in the same
 * commit that merges it, not before.
 *
 * /es and /es/* are redirected (301) to their English equivalent before any
 * of the above runs — a retired Spanish URL never needs a CSP header, it
 * just needs to leave.
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/es' || pathname.startsWith('/es/')) {
    const url = request.nextUrl.clone();
    url.pathname = englishPathForSpanishPath(pathname);
    return NextResponse.redirect(url, 301);
  }

  const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'https://lifewellfhp-server.vercel.app';

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    'frame-src https://ehr.charmtracker.com https://www.youtube-nocookie.com https://player.vimeo.com https://challenges.cloudflare.com https://www.google.com/maps/ https://maps.google.com',
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
