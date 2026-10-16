import { NextResponse } from 'next/server';
import {
  EXPRESS_API_URL,
  SESSION_COOKIE,
  sessionCookieOptions,
  trustedClientIpHeaders,
  protectionBypassHeaders,
} from '@/lib/session';

/**
 * Step 2 of login (Phase 1 item 5, MFA) — exchanges the short-lived
 * mfa-pending token (from .../auth/login's mfaRequired response) plus a
 * TOTP/recovery code for a real session. Same shape as the login route:
 * strips the raw token from the response body and sets it as the httpOnly
 * session cookie instead — client JS never sees it either way.
 */
export async function POST(request: Request) {
  const body = await request.text();

  const upstream = await fetch(`${EXPRESS_API_URL}/api/admin/auth/mfa-verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...trustedClientIpHeaders(request),
      ...protectionBypassHeaders(),
    },
    body,
  });

  const json = await upstream.json().catch(() => ({}));

  if (!upstream.ok || !json?.data?.token) {
    return NextResponse.json(json, { status: upstream.status });
  }

  const response = NextResponse.json({ success: true, data: { user: json.data.user } }, { status: upstream.status });
  response.cookies.set(SESSION_COOKIE, json.data.token, sessionCookieOptions());
  return response;
}
