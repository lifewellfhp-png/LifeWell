import { NextResponse } from 'next/server';
import {
  EXPRESS_API_URL,
  SESSION_COOKIE,
  sessionCookieOptions,
  trustedClientIpHeaders,
  protectionBypassHeaders,
} from '@/lib/session';

/**
 * The only route that ever sees the raw JWT from Express. Sets it as an
 * httpOnly cookie (first-party, since this app and the browser share an
 * origin) and strips it from the JSON body — client JS never has it, unlike
 * the old localStorage approach. Cookie is set via NextResponse.cookies
 * (not next/headers' cookies()) so this handler works when invoked directly
 * in tests, not only inside Next's own request-scoped runtime.
 */
export async function POST(request: Request) {
  const body = await request.text();

  const upstream = await fetch(`${EXPRESS_API_URL}/api/admin/auth/login`, {
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
