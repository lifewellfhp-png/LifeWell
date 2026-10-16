import { NextResponse, type NextRequest } from 'next/server';
import {
  EXPRESS_API_URL,
  SESSION_COOKIE,
  trustedClientIpHeaders,
  protectionBypassHeaders,
} from '@/lib/session';

/**
 * Bumps token_version server-side (Phase 1 item 4) — the same revocation
 * mechanism handleChangePassword already uses — so the token itself stops
 * passing requireAdmin immediately, not just in this browser. Always clears
 * the local httpOnly cookie regardless of whether that call succeeds
 * (client JS can't clear it itself): if Express is briefly unreachable, the
 * user still ends up logged out of this browser, even though the token
 * would technically remain valid elsewhere until it hits its own 8h cap.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      await fetch(`${EXPRESS_API_URL}/api/admin/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...trustedClientIpHeaders(request),
          ...protectionBypassHeaders(),
        },
      });
    } catch {
      // Best-effort — see doc comment above.
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
