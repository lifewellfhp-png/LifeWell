import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Signs/verifies the public marketing-unsubscribe token (P4-I3). Reuses
 * ADMIN_JWT_SECRET — the same already-boot-validated, >=32-char secret used
 * for admin sessions and the CSV import preview token
 * (server/src/lib/marketingImportToken.ts) — rather than inventing a new
 * one. As with that token, a distinct `type` claim and a payload shape with
 * no `sub`/`role`/`permissions`/`tv` makes this token structurally
 * incompatible with the admin-session scheme in both directions: fed into
 * requireAdmin it has no `sub` to look up (fails closed, 401); an admin
 * session token fed into verifyMarketingUnsubscribeToken fails the `type`
 * check.
 *
 * Claims are deliberately minimal: just enough to identify which contact a
 * click is for. No email, name, audience, or clinical information — a
 * captured/forwarded link reveals nothing about the person beyond an opaque
 * contact id, and even that requires already possessing a validly-signed
 * token to resolve into a database row.
 *
 * Lifetime: 180 days, not the CSV import preview's 20 minutes — deliberately
 * different, because this token's job is different. A CSV preview token
 * bridges two clicks by the same admin, seconds apart, inside one session;
 * an unsubscribe link will eventually be embedded in a marketing email
 * (P4-I5, not built yet) that may sit unread in an inbox for weeks or
 * months before the recipient acts on it — the link must still work then.
 * 180 days comfortably covers that realistic "old email, finally opened"
 * case while still eventually expiring rather than being permanently valid.
 * A non-expiring token was considered and rejected: the operation it
 * authorizes has a narrow, low-severity blast radius (it can only ever
 * move ONE specific contact toward `unsubscribed`, never subscribe, never
 * reveal PII, never touch any other row — and even that is fully
 * reversible by an admin via the dedicated resubscribe endpoint), so the
 * downside of a long-but-bounded lifetime is small, while a bounded
 * lifetime is still strictly safer than an unbounded one for a token that
 * will end up embedded in outbound email and can be forwarded, archived,
 * or leaked. If a genuinely old link ever does expire, the recipient's
 * only recourse today is contacting the practice directly — no
 * resend-link flow exists yet, since campaign delivery (P4-I5) is not
 * built.
 */

const TOKEN_TYPE = 'marketing_contacts_unsubscribe';
export const UNSUBSCRIBE_TOKEN_TTL_DAYS = 180;

export type UnsubscribeTokenPayload = {
  type: typeof TOKEN_TYPE;
  contactId: string;
};

export function createMarketingUnsubscribeToken(contactId: string): string {
  const payload: UnsubscribeTokenPayload = { type: TOKEN_TYPE, contactId };
  return jwt.sign(payload, env.ADMIN_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${UNSUBSCRIBE_TOKEN_TTL_DAYS}d`,
  });
}

/** Throws (jwt's own TokenExpiredError/JsonWebTokenError, or a plain Error for a type mismatch) on any invalid, tampered, or expired token. */
export function verifyMarketingUnsubscribeToken(token: string): UnsubscribeTokenPayload {
  const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET, { algorithms: ['HS256'] }) as UnsubscribeTokenPayload;
  if (decoded.type !== TOKEN_TYPE) {
    throw new Error('Not a marketing contacts unsubscribe token.');
  }
  return decoded;
}
