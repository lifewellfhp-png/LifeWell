import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase.js';
import { AppError, badRequest, notFound } from '../utils/errors.js';
import { fieldErrors } from '../validation/schemas.js';
import { marketingCampaignSendSchema } from '../validation/adminSchemas.js';
import { writeAuditLog } from '../lib/audit.js';
import type { AuthedRequest } from '../middleware/adminAuth.js';
import { env } from '../config/env.js';
import { buildRecipientEligibilityFilters, isCampaignDeliveryLocked } from '../controllers/marketingCampaigns.controller.js';
import { isUniqueEmailViolation } from '../controllers/marketingContacts.controller.js';
import { sendViaPauboxApi, escapeHtml, pauboxConfigured, type PauboxApiResult } from './email.service.js';
import { createMarketingUnsubscribeToken } from '../lib/marketingUnsubscribeToken.js';

// Colocated here (not in marketingCampaigns.controller.ts) deliberately:
// this file already imports buildRecipientEligibilityFilters FROM that
// controller, so importing the reverse direction there would create a
// circular module dependency. admin.routes.ts already imports Express
// handlers from several different controller/service files for this
// resource (marketingContacts.controller.ts, marketingContactsImport.
// controller.ts, marketingCampaigns.controller.ts) — adding this one is
// consistent with that existing pattern, and keeps the already-shipped,
// already-tested P4-I4B draft-CRUD controller completely untouched.
const uuidParam = z.string().uuid();

/**
 * Manual campaign delivery (P4-I5B). See the P4-I5B report for the full
 * concurrency/idempotency/timeout-safety analysis this file implements —
 * the short version:
 *
 * - Campaign-level duplicate-initiation protection needs no new schema:
 *   the FIRST bulk INSERT of snapshot rows for a campaign (no
 *   ON CONFLICT clause) either fully succeeds (this call is now the sole
 *   owner of this campaign's delivery) or fully fails with a 23505 unique
 *   violation (someone — a concurrent request, or the same campaign
 *   already sent earlier — already owns it), because a single multi-row
 *   INSERT statement is atomic in Postgres: any one conflicting row aborts
 *   the whole statement, so nothing is partially inserted.
 * - Per-recipient concurrency safety uses an atomic claim UPDATE
 *   (`WHERE status = 'pending'`), which is redundant with the guarantee
 *   above under this file's own call pattern, but is kept as defense in
 *   depth and as the crash-safe record of "an attempt was started."
 * - No automatic retry exists anywhere in this file. A timed-out/network-
 *   errored provider call (genuinely unknown whether Paubox received it)
 *   is recorded as `failed` with `failure_code: 'timeout_ambiguous'` —
 *   deliberately distinct from `failure_code: 'provider_rejected'` (a real
 *   non-2xx response was received) — so a FUTURE reconciliation phase
 *   (not built here) can tell the difference and must never treat
 *   'timeout_ambiguous' rows as safe to blindly retry.
 */

/**
 * Conservative bound on eligible recipients per manual send (P4-I5B
 * section 27). No maxDuration was configured anywhere in this repo before
 * this phase (now set to 60s in server/vercel.json, the highest value
 * valid on every Vercel plan tier without risking a deployment-time
 * rejection on a lower tier). Paubox itself has no documented/verified
 * bulk-sending latency figures available to this codebase, and the
 * existing wrapper's own per-call timeout is 20s — so this number is a
 * considered, intentionally conservative estimate, not an empirically
 * measured one: it assumes sequential per-recipient calls averaging a few
 * seconds each, well under the 60s budget, with real headroom left for
 * snapshot creation, revalidation reads, and the rare slow outlier. See
 * the P4-I5B report for the full reasoning and the explicit recommendation
 * to revisit this number once real send durations are observed.
 */
export const MAX_SEND_RECIPIENTS = 25;

export const FAILURE_CODES = {
  PROVIDER_REJECTED: 'provider_rejected',
  TIMEOUT_AMBIGUOUS: 'timeout_ambiguous',
  NOT_CONFIGURED: 'not_configured',
} as const;

/** Only a draft campaign may be sent — archived is permanently terminal. */
export function assertCampaignSendable(campaign: { status: string; delivery_locked?: boolean }): void {
  if (campaign.delivery_locked === true) {
    throw new AppError('This campaign has already had delivery initiated and cannot be sent.', 409, { expose: true });
  }
  if (campaign.status !== 'draft') {
    throw new AppError('Only a draft campaign can be sent.', 409, { expose: true });
  }
}

/**
 * Maps a raw Paubox API result to the recipient row's terminal outcome —
 * pure and synthetic-input-testable, no network call. httpStatus === 0
 * means sendViaPauboxApi never received a response at all (timeout or
 * network error, per its own implementation) — the genuinely ambiguous
 * case this phase must never conflate with a definite rejection.
 */
export function classifyProviderOutcome(result: PauboxApiResult): {
  status: 'sent' | 'failed';
  failure_code?: string;
  provider_message_id?: string;
} {
  if (result.ok) {
    return { status: 'sent', provider_message_id: result.sourceTrackingId };
  }
  if (result.httpStatus === 0) {
    return { status: 'failed', failure_code: FAILURE_CODES.TIMEOUT_AMBIGUOUS };
  }
  return { status: 'failed', failure_code: FAILURE_CODES.PROVIDER_REJECTED };
}

/** The one, non-Admin-editable unsubscribe link every outbound campaign message carries. */
export function buildUnsubscribeUrl(token: string): string {
  return `${env.PUBLIC_SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Assembles the final outbound message from persisted campaign content
 * plus the system-controlled unsubscribe footer. preview_text is
 * deliberately NOT included here: it is a preheader concept (a client-
 * rendered inbox snippet), and the existing Paubox wrapper has no distinct
 * preheader field — folding it into the visible body would misrepresent
 * its purpose rather than serve it, so campaign.subject and campaign.content
 * are the only campaign-authored inputs to the message. The Admin's own
 * campaign content can never remove or alter the footer: it is appended
 * here, in code, after the Admin-authored content, never accepted as part
 * of it.
 *
 * html is a minimal escape-and-preserve-whitespace wrapper — the exact
 * same technique already used by sendOutboundMail() in email.service.ts —
 * not a new template mechanism, and not "converting plain text into
 * unsanitized HTML": every character is HTML-escaped.
 */
export function buildCampaignEmailContent(input: {
  subject: string;
  content: string;
  unsubscribeUrl: string;
}): { text: string; html: string } {
  const footer = `To stop receiving marketing emails from LifeWell, unsubscribe here: ${input.unsubscribeUrl}`;
  const text = `${input.content}\n\n—\n${footer}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#374151;line-height:1.6">
      <div style="white-space:pre-wrap">${escapeHtml(input.content)}</div>
      <p style="margin-top:24px;font-size:12px;color:#5b6675">${escapeHtml(footer)}</p>
    </div>
  `;
  return { text, html };
}

type EligibleContact = { id: string; email: string; marketing_status: string };

async function fetchEligibleContacts(audienceType: string | null): Promise<EligibleContact[]> {
  const filters = buildRecipientEligibilityFilters(audienceType);
  let query = getSupabase()
    .from('marketing_contacts')
    .select('id, email, marketing_status')
    .eq('marketing_status', filters.marketing_status);
  if (filters.audience_type) {
    query = query.eq('audience_type', filters.audience_type);
  }
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return (data ?? []) as EligibleContact[];
}

export type CampaignSendResult = {
  requested: number;
  snapshotted: number;
  sent: number;
  failed: number;
  skipped: number;
};

/**
 * Orchestrates one manual campaign send from end to end. Follows the exact
 * ordering the P4-I5B task itself prescribes: validate -> compute eligible
 * -> enforce maximum -> snapshot -> revalidate + send per row -> persist
 * outcome -> audit -> return truthful aggregate counts.
 */
export async function initiateCampaignSend(
  campaignId: string,
  actor: AuthedRequest['admin']
): Promise<CampaignSendResult> {
  const sb = getSupabase();

  const { data: campaign, error: campaignError } = await sb
    .from('marketing_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();
  if (campaignError) throw badRequest(campaignError.message);
  if (!campaign) throw notFound('Marketing campaign not found.');

  const deliveryLocked = await isCampaignDeliveryLocked(campaignId);
  assertCampaignSendable({ ...campaign, delivery_locked: deliveryLocked });

  const eligible = await fetchEligibleContacts(campaign.audience_type as string | null);

  if (eligible.length > MAX_SEND_RECIPIENTS) {
    throw new AppError(
      `This campaign has ${eligible.length} currently eligible contacts, which exceeds the maximum of ${MAX_SEND_RECIPIENTS} per send. Split the audience into a smaller segment, or contact support to raise this limit.`,
      422,
      { expose: true }
    );
  }

  const result: CampaignSendResult = { requested: eligible.length, snapshotted: 0, sent: 0, failed: 0, skipped: 0 };

  if (eligible.length === 0) {
    await writeAuditLog({
      actor,
      action: 'send_initiated',
      resource: 'marketing_campaigns',
      resourceId: campaignId,
      summary: 'Initiated marketing campaign send',
      meta: { eligible_count: 0, snapshotted_count: 0 },
    });
    await writeAuditLog({
      actor,
      action: 'send_completed',
      resource: 'marketing_campaigns',
      resourceId: campaignId,
      summary: 'Completed marketing campaign send',
      meta: { sent_count: 0, failed_count: 0, skipped_count: 0 },
    });
    return result;
  }

  // The atomic campaign-level duplicate-initiation guard: a single
  // multi-row INSERT with no ON CONFLICT clause. If ANY row already
  // exists for this campaign (a concurrent request, or an earlier send),
  // Postgres aborts the ENTIRE statement — nothing is partially inserted,
  // and this call is cleanly refused rather than silently resending a
  // subset.
  const { data: inserted, error: insertError } = await sb
    .from('marketing_campaign_recipients')
    .insert(
      eligible.map((c) => ({
        campaign_id: campaignId,
        contact_id: c.id,
        email_snapshot: c.email,
      }))
    )
    .select('*');

  if (insertError) {
    if (isUniqueEmailViolation(insertError)) {
      throw new AppError('This campaign has already had delivery initiated.', 409, { expose: true });
    }
    throw badRequest(insertError.message);
  }

  const snapshotRows = inserted ?? [];
  result.snapshotted = snapshotRows.length;

  await writeAuditLog({
    actor,
    action: 'send_initiated',
    resource: 'marketing_campaigns',
    resourceId: campaignId,
    summary: 'Initiated marketing campaign send',
    meta: { eligible_count: eligible.length, snapshotted_count: snapshotRows.length },
  });

  for (const row of snapshotRows) {
    // Atomic per-row claim — defense in depth (see module docblock) and
    // the crash-safe record that an attempt was started.
    const { data: claimed, error: claimError } = await sb
      .from('marketing_campaign_recipients')
      .update({
        status: 'processing',
        attempt_count: (row.attempt_count ?? 0) + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (claimError) throw badRequest(claimError.message);
    if (!claimed) continue; // Already claimed/resolved — should not happen under this file's own call pattern, but never double-process.

    // Immediate pre-send revalidation (P4-I5B section 7): re-read the
    // CURRENT contact status, not the snapshot. A contact who unsubscribed
    // between snapshot creation and this exact moment must never receive
    // this message.
    const { data: currentContact, error: contactError } = await sb
      .from('marketing_contacts')
      .select('marketing_status')
      .eq('id', row.contact_id)
      .maybeSingle();
    if (contactError) throw badRequest(contactError.message);

    if (!currentContact || currentContact.marketing_status !== 'subscribed') {
      await sb.from('marketing_campaign_recipients').update({ status: 'skipped' }).eq('id', row.id);
      result.skipped += 1;
      continue;
    }

    if (!pauboxConfigured) {
      await sb
        .from('marketing_campaign_recipients')
        .update({ status: 'failed', failed_at: new Date().toISOString(), failure_code: FAILURE_CODES.NOT_CONFIGURED })
        .eq('id', row.id);
      result.failed += 1;
      continue;
    }

    const token = createMarketingUnsubscribeToken(row.contact_id);
    const unsubscribeUrl = buildUnsubscribeUrl(token);
    const { text, html } = buildCampaignEmailContent({
      subject: campaign.subject as string,
      content: campaign.content as string,
      unsubscribeUrl,
    });

    // One recipient per provider request (P4-I5B section 14/15) — never a
    // multi-recipient/BCC blast. token/unsubscribeUrl exist only in this
    // function's local scope: never persisted, never logged.
    const providerResult = await sendViaPauboxApi({
      to: { address: row.email_snapshot },
      subject: campaign.subject as string,
      text,
      html,
    });

    const outcome = classifyProviderOutcome(providerResult);
    if (outcome.status === 'sent') {
      await sb
        .from('marketing_campaign_recipients')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: outcome.provider_message_id ?? null,
        })
        .eq('id', row.id);
      result.sent += 1;
    } else {
      await sb
        .from('marketing_campaign_recipients')
        .update({ status: 'failed', failed_at: new Date().toISOString(), failure_code: outcome.failure_code })
        .eq('id', row.id);
      result.failed += 1;
    }
  }

  await writeAuditLog({
    actor,
    action: 'send_completed',
    resource: 'marketing_campaigns',
    resourceId: campaignId,
    summary: 'Completed marketing campaign send',
    meta: { sent_count: result.sent, failed_count: result.failed, skipped_count: result.skipped },
  });

  return result;
}

/**
 * POST /api/admin/marketing-campaigns/:id/send. No campaign content is
 * ever accepted from this request — the body carries only the explicit
 * `confirm: true` attestation; the server uses the already-persisted
 * campaign row exclusively.
 */
export async function sendMarketingCampaign(req: Request, res: Response): Promise<void> {
  const parsedId = uuidParam.safeParse(req.params.id);
  if (!parsedId.success) throw badRequest('Invalid campaign id.');

  const parsed = marketingCampaignSendSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Explicit confirmation is required to send this campaign.', fieldErrors(parsed.error));
  }

  const actor = (req as AuthedRequest).admin;
  const result = await initiateCampaignSend(parsedId.data, actor);
  res.json({ success: true, data: result });
}
