import type { NextFunction, Request, Response, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { getSupabase } from '../lib/supabase.js';

export type AdminRole = 'super_admin' | 'staff';

export type AdminTokenPayload = {
  sub: string;
  email: string;
  role: AdminRole;
  permissions: string[];
  /**
   * Token version at the time this JWT was signed. admin_users.token_version
   * increments on every password change; requireAdmin rejects any token
   * whose `tv` no longer matches the row's current value. This is what
   * makes "revoke existing sessions" real for an otherwise fully stateless
   * bearer token — without it, a JWT stays valid until its 30-day expiry
   * regardless of a password change.
   */
  tv: number;
};

export type AuthedRequest = Request & {
  admin?: AdminTokenPayload;
};

/**
 * Phase 1 item 5 (MFA): issued after a correct email/password but before the
 * TOTP/recovery-code step completes. Deliberately a DIFFERENT shape from
 * AdminTokenPayload (no role/permissions/tv) and a very short lifetime, so
 * it can never be mistaken for, or silently accepted as, a real session —
 * requireAdmin below explicitly rejects any token carrying this `purpose`
 * marker, rather than relying only on the shape difference.
 */
export type MfaPendingTokenPayload = {
  sub: string;
  purpose: 'mfa-pending';
};

const ALL_MODULES = [
  'leads',
  'announcements',
  'services',
  'providers',
  'insurance',
  'testimonials',
  'faqs',
  'locations',
  'telehealth_states',
  'blog',
  'media',
  'videos',
  'sections',
  'booking',
  'seo',
  'analytics',
  'users',
  'emails',
  'settings',
  // P4-I2C: marketing contact directory.
  'marketing_contacts',
  // P4-I4B: campaign DRAFT management only (create/edit/archive drafts,
  // recipient-count preview). A separate, later module would gate actual
  // send/delivery once that exists — not added yet, and this module does
  // not grant it.
  'marketing_campaigns',
] as const;

export type AdminModule = (typeof ALL_MODULES)[number];

/**
 * 8-hour absolute lifetime (Phase 1 item 4) — this exp claim is never
 * extended once issued; it's what actually enforces "logged out no later
 * than 8h after login" regardless of activity. The separate 30-minute idle
 * timeout is enforced one layer up, by the admin app's own httpOnly cookie
 * Max-Age sliding on each request (see admin/src/lib/session.ts) — a token
 * that's still within its 8h window but whose cookie expired client-side
 * simply never gets sent again. Was '30d'.
 */
export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, env.ADMIN_JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  // Explicitly restricts accepted algorithms rather than trusting whatever
  // the token header claims (jsonwebtoken's default behavior) — defense in
  // depth against algorithm-confusion attacks (P4-G4/P4-G4A).
  return jwt.verify(token, env.ADMIN_JWT_SECRET, { algorithms: ['HS256'] }) as AdminTokenPayload;
}

/**
 * 5-minute lifetime — just long enough to type a 6-digit code, short enough
 * that a leaked/logged value is worthless shortly after. Signed with the
 * same secret as a real session token (no separate secret is needed: the
 * `purpose` marker plus requireAdmin's explicit rejection of it is what
 * keeps the two token kinds from ever being confused with each other).
 */
export function signMfaPendingToken(sub: string): string {
  return jwt.sign({ sub, purpose: 'mfa-pending' }, env.ADMIN_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '5m',
  });
}

export function verifyMfaPendingToken(token: string): MfaPendingTokenPayload {
  const payload = jwt.verify(token, env.ADMIN_JWT_SECRET, { algorithms: ['HS256'] }) as Record<string, unknown>;
  if (payload.purpose !== 'mfa-pending' || typeof payload.sub !== 'string') {
    throw new Error('Not an MFA-pending token.');
  }
  return payload as unknown as MfaPendingTokenPayload;
}

/**
 * The actual revocation decision, pulled out as a pure function so it can be
 * tested directly against synthetic lookup results without a live Supabase
 * connection (P4-G4A) — requireAdmin below calls this with its real query
 * result, unchanged behavior, just a named/testable condition.
 */
export function isSessionRevoked(
  lookup: { data: { token_version: number | null; active: boolean } | null; error: unknown },
  tokenVersion: number
): boolean {
  return Boolean(
    lookup.error ||
      !lookup.data ||
      (lookup.data.token_version ?? 0) !== tokenVersion ||
      lookup.data.active === false
  );
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Sign in required.'));
    return;
  }
  let payload: AdminTokenPayload;
  try {
    payload = verifyAdminToken(header.slice(7));
  } catch {
    next(unauthorized('Session expired. Please sign in again.'));
    return;
  }

  // An MFA-pending token (Phase 1 item 5) must never be usable as a real
  // session, regardless of what its tv/role/permissions fields look like —
  // checked explicitly here rather than relying only on it lacking those
  // fields (which, for an account still on token_version 0, would otherwise
  // slip past the revocation check below).
  if ((payload as unknown as { purpose?: string }).purpose === 'mfa-pending') {
    next(unauthorized('Session expired. Please sign in again.'));
    return;
  }

  // Tokens signed before token versioning (or by a test fixture) omit `tv`;
  // treat that as version 0 rather than failing every existing session.
  const tokenVersion = typeof payload.tv === 'number' ? payload.tv : 0;

  Promise.resolve()
    .then(() =>
      getSupabase()
        .from('admin_users')
        .select('token_version, active')
        .eq('id', payload.sub)
        .maybeSingle()
    )
    .then(({ data, error }) => {
      // Same single query as before, now also checking `active` (P4-G4A) so
      // a disabled account is rejected even if some future code path ever
      // sets active=false without bumping token_version — a generic message
      // either way, never revealing which condition failed.
      if (isSessionRevoked({ data, error }, tokenVersion)) {
        next(unauthorized('Session expired. Please sign in again.'));
        return;
      }
      (req as AuthedRequest).admin = payload;
      next();
    })
    .catch(() => next(unauthorized('Session expired. Please sign in again.')));
};

export function requirePermission(module: AdminModule): RequestHandler {
  return requireAnyPermission([module]);
}

export function requireAnyPermission(modules: AdminModule[]): RequestHandler {
  return (req, _res, next) => {
    const admin = (req as AuthedRequest).admin;
    if (!admin) {
      next(unauthorized('Sign in required.'));
      return;
    }
    if (admin.role === 'super_admin') {
      next();
      return;
    }
    if (admin.permissions.includes('*') || modules.some((module) => admin.permissions.includes(module))) {
      next();
      return;
    }
    next(forbidden('You do not have permission for this module.'));
  };
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  const admin = (req as AuthedRequest).admin;
  if (!admin || admin.role !== 'super_admin') {
    next(forbidden('Super admin access required.'));
    return;
  }
  next();
}

export { ALL_MODULES };
