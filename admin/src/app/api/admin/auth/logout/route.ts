import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

/**
 * Clears the httpOnly cookie — client JS can't do this itself. Phase 1 item
 * 4 will extend this to also bump token_version server-side so the token
 * itself stops working everywhere, not just in this browser; for now this
 * matches the pre-existing behavior (logout was purely local) plus the new
 * cookie needing a server response to clear at all.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
