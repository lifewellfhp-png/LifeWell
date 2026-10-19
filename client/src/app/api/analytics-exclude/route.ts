import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'lw_exclude_analytics';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Sets or clears the plain, non-HttpOnly cookie that
 * client/src/lib/cms.ts's trackPageView/trackConversion check before
 * ever making an analytics/conversion request. Lives on THIS app's own
 * domain (www.lifewellfhp.com) rather than the Admin app's — the two
 * apps have no custom-domain relationship (Admin has no custom domain at
 * all) and so can't share a cookie; a cross-origin fetch with
 * `credentials: 'include'` to set one here would be exactly the
 * third-party-cookie pattern browsers are increasingly blocking. The
 * Admin Analytics page instead opens this URL in a new tab — a direct,
 * first-party, top-level navigation to this domain, which isn't subject
 * to that blocking.
 *
 * GET only (not a mutation of any application data — this just sets a
 * preference cookie in the requester's own browser), `?enable=1` to
 * exclude this browser's future visits, `?enable=0` to stop excluding.
 */
export async function GET(req: Request) {
  const enable = new URL(req.url).searchParams.get('enable') === '1';

  const html = enable
    ? '<!doctype html><title>Tracking disabled</title><p>Analytics tracking is now disabled for this browser. You can close this tab.</p>'
    : '<!doctype html><title>Tracking re-enabled</title><p>Analytics tracking is re-enabled for this browser. You can close this tab.</p>';

  const res = new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  if (enable) {
    res.cookies.set(COOKIE_NAME, '1', {
      maxAge: ONE_YEAR_SECONDS,
      path: '/',
      secure: true,
      sameSite: 'lax',
    });
  } else {
    res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/', secure: true, sameSite: 'lax' });
  }

  return res;
}
