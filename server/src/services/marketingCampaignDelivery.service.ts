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
 * First-name personalization (Labor Day 2026 subscriber-greeting work).
 * This is genuinely new capability — no token-substitution mechanism
 * existed anywhere in this codebase before this change; campaign content
 * was always static plain text applied identically to every recipient.
 *
 * Token syntax, embedded literally in a campaign's stored `subject`/
 * `content`/`html_body`:
 *   {{first_name}}          — subject only. Substituted with the
 *                              recipient's normalized first name. A
 *                              campaign using this MUST also set
 *                              subject_fallback for the no-name case —
 *                              this is never itself replaced with a
 *                              generic word, since "there, wishing you..."
 *                              reads worse than a non-personalized subject.
 *   {{first_name_or_there}} — content/html_body. Substituted with the
 *                              recipient's normalized first name, or the
 *                              literal word "there" when no usable name
 *                              exists. Never left unsubstituted.
 *   {{unsubscribe_url}}     — content/html_body, optional. Lets a
 *                              campaign's own compliance footer embed the
 *                              real unsubscribe link inline (e.g. inside
 *                              a styled <a> tag) instead of relying on the
 *                              generic appended-line fallback below.
 *
 * Exact string substitution (no regex), so there is no possibility of an
 * unintended partial match or ReDoS surface from recipient-controlled
 * input — first names are never used as pattern text, only as
 * replacement values.
 */
const GREETING_TOKEN = '{{first_name_or_there}}';
const SUBJECT_TOKEN = '{{first_name}}';
const UNSUBSCRIBE_TOKEN = '{{unsubscribe_url}}';
const MAX_FIRST_NAME_LENGTH = 60;

function replaceAllLiteral(haystack: string, token: string, value: string): string {
  return haystack.split(token).join(value);
}

/**
 * Normalizes a raw first name for use in a greeting or subject line: trims
 * whitespace, and rejects blank, excessively long, or control-character/
 * angle-bracket-containing values (a data-quality problem at best, an
 * injection attempt at worst) rather than rendering them as-is. Returns
 * null for "no usable name" — callers substitute the safe literal "there"
 * in a greeting, or an entirely separate, non-personalized subject line.
 */
export function normalizeFirstName(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_FIRST_NAME_LENGTH) return null;
  // Rejects blank-after-trim already handled above; here we reject any
  // control character or angle bracket via explicit char-code checks
  // (avoids embedding a literal control-character range in a regex).
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }
  if (trimmed.includes('<') || trimmed.includes('>')) return null;
  return trimmed;
}

/** The exact greeting name to display — the real name, or "there". Never blank, never the raw token. */
export function greetingDisplayName(firstName: string | null | undefined): string {
  return normalizeFirstName(firstName) ?? 'there';
}

/**
 * Personalized subject when a usable name exists; the campaign's own
 * distinct subject_fallback (or, absent one, the base subject unchanged)
 * when it does not. Never leaves a {{first_name}} token unsubstituted in
 * an outbound subject line.
 */
export function renderCampaignSubject(
  campaign: { subject: string; subject_fallback?: string | null },
  firstName: string | null | undefined
): string {
  const name = normalizeFirstName(firstName);
  if (!name) return campaign.subject_fallback || campaign.subject;
  return replaceAllLiteral(campaign.subject, SUBJECT_TOKEN, name);
}

/**
 * Assembles the final outbound message from persisted campaign content
 * plus the system-controlled unsubscribe link. preview_text is
 * deliberately NOT included here: it is a preheader concept (a client-
 * rendered inbox snippet), and the existing Paubox wrapper has no distinct
 * preheader field — a campaign that wants a preheader embeds it directly
 * in html_body instead. The Admin's own campaign content can never remove
 * or alter the unsubscribe mechanism: when html_body has no
 * {{unsubscribe_url}} token, or when there is no html_body at all, a
 * fixed, code-controlled unsubscribe line is appended — never accepted as
 * part of the Admin-authored content itself.
 *
 * When htmlBody is absent (every campaign created before this change, and
 * any future campaign that doesn't need rich HTML), behavior is byte-for-
 * byte identical to the original implementation: a minimal escape-and-
 * preserve-whitespace wrapper, the exact same technique already used by
 * sendOutboundMail() in email.service.ts. Every character substituted into
 * HTML output is HTML-escaped via the existing escapeHtml() — no new
 * escaping mechanism.
 */
export function buildCampaignEmailContent(input: {
  subject: string;
  content: string;
  htmlBody?: string | null;
  unsubscribeUrl: string;
  firstName?: string | null;
}): { text: string; html: string } {
  const displayName = greetingDisplayName(input.firstName);
  const footerLine = `To stop receiving marketing emails from LifeWell, unsubscribe here: ${input.unsubscribeUrl}`;

  const greetedText = replaceAllLiteral(input.content, GREETING_TOKEN, displayName);
  const textHasEmbeddedUnsubscribe = greetedText.includes(UNSUBSCRIBE_TOKEN);
  const personalizedText = textHasEmbeddedUnsubscribe
    ? replaceAllLiteral(greetedText, UNSUBSCRIBE_TOKEN, input.unsubscribeUrl)
    : greetedText;
  const text = textHasEmbeddedUnsubscribe ? personalizedText : `${personalizedText}\n\n—\n${footerLine}`;

  if (input.htmlBody) {
    const html = replaceAllLiteral(
      replaceAllLiteral(input.htmlBody, GREETING_TOKEN, escapeHtml(displayName)),
      UNSUBSCRIBE_TOKEN,
      escapeHtml(input.unsubscribeUrl)
    );
    return { text, html };
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#374151;line-height:1.6">
      <div style="white-space:pre-wrap">${escapeHtml(personalizedText)}</div>
      <p style="margin-top:24px;font-size:12px;color:#5b6675">${escapeHtml(footerLine)}</p>
    </div>
  `;
  return { text, html };
}

type EligibleContact = { id: string; email: string; marketing_status: string; first_name: string | null };

async function fetchEligibleContacts(audienceType: string | null): Promise<EligibleContact[]> {
  const filters = buildRecipientEligibilityFilters(audienceType);
  let query = getSupabase()
    .from('marketing_contacts')
    .select('id, email, marketing_status, first_name')
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
  // In-memory only — never written to marketing_campaign_recipients, which
  // deliberately snapshots only the destination address (see this file's
  // module docblock and the P4-I5A schema comment on email_snapshot).
  const firstNameByContactId = new Map(eligible.map((c) => [c.id, c.first_name]));

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
    const firstName = firstNameByContactId.get(row.contact_id) ?? null;
    const subject = renderCampaignSubject(
      { subject: campaign.subject as string, subject_fallback: campaign.subject_fallback as string | null },
      firstName
    );
    const { text, html } = buildCampaignEmailContent({
      subject: campaign.subject as string,
      content: campaign.content as string,
      htmlBody: campaign.html_body as string | null,
      unsubscribeUrl,
      firstName,
    });

    // One recipient per provider request (P4-I5B section 14/15) — never a
    // multi-recipient/BCC blast. token/unsubscribeUrl/firstName exist only
    // in this function's local scope: never persisted, never logged.
    const providerResult = await sendViaPauboxApi({
      to: { address: row.email_snapshot },
      subject,
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
