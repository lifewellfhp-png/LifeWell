import type { Request, Response } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';
import { marketingUnsubscribeSchema } from '../validation/schemas.js';
import { verifyMarketingUnsubscribeToken } from '../lib/marketingUnsubscribeToken.js';
import { writeAuditLog } from '../lib/audit.js';

/**
 * Public marketing unsubscribe (P4-I3). No requireAdmin — this is the one
 * public-facing marketing_contacts mutation, authorized solely by
 * possession of a purpose-specific signed token (never a raw email
 * address; see marketingUnsubscribeSchema).
 *
 * Every outcome that reaches an actual token verification returns the same
 * neutral success message, regardless of whether the contact was pending,
 * subscribed, already unsubscribed, or suppressed — so the response itself
 * can never be used to enumerate a contact's current state (P4-I3 section
 * 9). Only token-level failures (malformed, tampered, expired, or a
 * well-formed-but-unresolvable contact id) get the distinct "invalid or
 * expired" response, which reveals nothing about any specific contact.
 */
export const NEUTRAL_SUCCESS_MESSAGE = 'You have been unsubscribed from marketing communications.';
export const INVALID_LINK_MESSAGE = 'This link is invalid or has expired.';

export type UnsubscribeOutcome =
  | { action: 'noop' }
  | { action: 'unsubscribe'; unsubscribed_at: string };

/**
 * The entire state-transition decision, as a pure function of the
 * contact's CURRENT status — extracted so it is directly unit-testable
 * without a live Supabase connection (matches resolvePagination/
 * resolveStatusTimestamps in marketingContacts.controller.ts and
 * classifyCsvRow in marketingContactsImport.controller.ts). `now` is
 * passed in rather than computed here so a test can assert the exact
 * timestamp used is the one the caller supplied, not something the
 * function invented on its own.
 *
 * suppressed and unsubscribed both resolve to 'noop': suppressed must
 * never be weakened (P4-I3 section 8), and unsubscribed must stay
 * idempotent — repeated calls never rewrite unsubscribed_at. Only pending
 * and subscribed produce a real write.
 */
export function resolveUnsubscribeOutcome(currentStatus: string, now: string): UnsubscribeOutcome {
  if (currentStatus === 'suppressed' || currentStatus === 'unsubscribed') {
    return { action: 'noop' };
  }
  return { action: 'unsubscribe', unsubscribed_at: now };
}

export async function handleMarketingUnsubscribe(req: Request, res: Response): Promise<void> {
  const parsedBody = marketingUnsubscribeSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ success: false, message: INVALID_LINK_MESSAGE });
    return;
  }

  let contactId: string;
  try {
    contactId = verifyMarketingUnsubscribeToken(parsedBody.data.token).contactId;
  } catch {
    res.status(400).json({ success: false, message: INVALID_LINK_MESSAGE });
    return;
  }

  const { data: contact, error: lookupError } = await getSupabase()
    .from('marketing_contacts')
    .select('id, marketing_status')
    .eq('id', contactId)
    .maybeSingle();
  if (lookupError) throw badRequest(lookupError.message);

  if (!contact) {
    // A validly-signed token whose contact id no longer resolves — there is
    // no delete path for this table today, so this should not occur in
    // practice, but it is handled the same neutral way rather than leaking
    // anything about why.
    res.status(400).json({ success: false, message: INVALID_LINK_MESSAGE });
    return;
  }

  const outcome = resolveUnsubscribeOutcome(contact.marketing_status as string, new Date().toISOString());

  if (outcome.action === 'unsubscribe') {
    // consent_source/consent_at are never touched, so historical consent
    // provenance survives an unsubscribe. suppression_reason/suppressed_at
    // are likewise never touched.
    const { error: updateError } = await getSupabase()
      .from('marketing_contacts')
      .update({
        marketing_status: 'unsubscribed',
        unsubscribed_at: outcome.unsubscribed_at,
        updated_at: outcome.unsubscribed_at,
      })
      .eq('id', contactId);
    if (updateError) throw badRequest(updateError.message);

    // No admin actor exists for a public event — writeAuditLog's `actor` is
    // already optional, so this is recorded as a system/no-actor entry
    // rather than inventing a fake admin identity. Aggregate outcome only,
    // no email, no name, no IP.
    await writeAuditLog({
      action: 'public_unsubscribe',
      resource: 'marketing_contacts',
      resourceId: contactId,
      summary: 'Public marketing unsubscribe',
      meta: { outcome: 'unsubscribed' },
    });
  }

  // Identical response text regardless of branch — see module docblock.
  res.json({ success: true, message: NEUTRAL_SUCCESS_MESSAGE });
}
