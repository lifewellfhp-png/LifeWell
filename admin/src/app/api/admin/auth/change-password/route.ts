import { NextResponse, type NextRequest } from 'next/server';
import {
  EXPRESS_API_URL,
  SESSION_COOKIE,
  sessionCookieOptions,
  trustedClientIpHeaders,
  protectionBypassHeaders,
} from '@/lib/session';

/**
 * Dedicated route rather than the generic catch-all: a successful password
 * change returns a fresh token (old token_version is revoked server-side),
 * which must replace the httpOnly cookie in place — client JS can no longer
 * do this itself (see the old setToken() call this replaces in
 * app/(app)/users/page.tsx). Reads/writes cookies via NextRequest/
 * NextResponse directly (not next/headers' cookies()) so this handler
 * works when invoked directly in tests too.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: 'Sign in required.' }, { status: 401 });
  }

  const body = await request.text();
  const upstream = await fetch(`${EXPRESS_API_URL}/api/admin/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...trustedClientIpHeaders(request),
      ...protectionBypassHeaders(),
    },
    body,
  });

  const json = await upstream.json().catch(() => ({}));

  if (upstream.ok && json?.data?.token) {
    const response = NextResponse.json({ success: true, data: {} }, { status: upstream.status });
    response.cookies.set(SESSION_COOKIE, json.data.token, sessionCookieOptions());
    return response;
  }

  return NextResponse.json(json, { status: upstream.status });
}
