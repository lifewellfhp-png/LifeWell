import { env, isProduction } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { serverError } from '../utils/errors.js';
import type { ContactInput } from '../validation/schemas.js';
import { getSupabase, supabaseConfigured } from '../lib/supabase.js';

/**
 * P4-D5: outbound mail goes through the Paubox REST Email API rather than
 * SMTP/Nodemailer (repeated production SMTP tests could not be confirmed as
 * reaching an external mailbox or the Paubox Mail Log — see P4-D4).
 *
 * The API key reused here is the exact same credential already stored in
 * SMTP_PASSWORD: Paubox issues one key usable either as the SMTP AUTH
 * password or as this REST API's Bearer token, so this avoids creating a
 * second, duplicate secret. SMTP_HOST/PORT/SECURE/USER are no longer read by
 * this file — they're left configured in Vercel deliberately, as a rollback
 * path back to the SMTP transport if this migration needs to be reverted.
 */
const PAUBOX_API_KEY = env.SMTP_PASSWORD;
const PAUBOX_ENDPOINT = 'https://api.paubox.com/v1/email/messages';
const PAUBOX_TIMEOUT_MS = 20_000;
const pauboxConfigured = Boolean(PAUBOX_API_KEY);

/** Escapes a value for safe interpolation into the HTML email body. */
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export interface DeliveryResult {
  delivered: boolean;
  referenceId: string;
  inbox: string;
}

/** Practice inbox for website enquiries. SMTP password stays in env only. */
export async function resolveInboxEmail(): Promise<string> {
  if (supabaseConfigured()) {
    try {
      const { data } = await getSupabase()
        .from('site_settings')
        .select('inbox_email, practice_email')
        .eq('id', 'default')
        .maybeSingle();
      const inbox = data?.inbox_email || data?.practice_email;
      if (typeof inbox === 'string' && inbox.includes('@')) return inbox;
    } catch {
      // Use env fallback.
    }
  }
  return env.CONTACT_EMAIL;
}

type PauboxAddress = { name?: string; address: string };

type PauboxApiResult = {
  ok: boolean;
  httpStatus: number;
  sourceTrackingId?: string;
  errorMessage?: string;
};

const formatAddress = (addr: PauboxAddress) => (addr.name ? `${addr.name} <${addr.address}>` : addr.address);

/**
 * Single low-level Paubox REST Email API call, shared by
 * sendContactNotification() and sendOutboundMail() so there is exactly one
 * place that knows how to talk to Paubox. Never throws — HTTP-level errors
 * (401/403/422/429/5xx) and network/timeout failures are both normalized
 * into `{ ok: false, httpStatus, errorMessage }` so callers apply their own
 * existing fallback behavior uniformly, the same way a thrown Nodemailer
 * error used to be caught by both callers before this migration.
 *
 * errorMessage is always a short, sanitized, provider-controlled or
 * category string — never the raw response body, which could in principle
 * echo back submitted content.
 */
async function sendViaPauboxApi(params: {
  to: PauboxAddress;
  subject: string;
  text: string;
  html: string;
  replyTo?: PauboxAddress;
}): Promise<PauboxApiResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAUBOX_TIMEOUT_MS);

  try {
    const res = await fetch(PAUBOX_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAUBOX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          message: {
            recipients: [formatAddress(params.to)],
            headers: {
              subject: params.subject,
              from: env.MAIL_FROM,
              ...(params.replyTo ? { 'reply-to': formatAddress(params.replyTo) } : {}),
            },
            content: {
              'text/plain': params.text,
              'text/html': params.html,
            },
          },
        },
      }),
      signal: controller.signal,
    });

    let sourceTrackingId: string | undefined;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).sourceTrackingId === 'string') {
        sourceTrackingId = (body as Record<string, unknown>).sourceTrackingId as string;
      }
    } catch {
      // Non-JSON or empty body — nothing to extract.
    }

    return {
      ok: res.ok,
      httpStatus: res.status,
      sourceTrackingId,
      errorMessage: res.ok ? undefined : `Paubox API responded ${res.status}`,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      httpStatus: 0,
      errorMessage: timedOut ? 'Paubox API request timed out' : 'Paubox API network error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sends the contact-form notification email.
 *
 * The free-text message is used transiently here — and in the request body
 * built below — to deliver the notification, which is the whole point of
 * the form. It is intentionally never written to leads.message or to
 * email_messages.body (see storeLead() and contact.controller.ts, P4-B2):
 * this function forwards the message, it does not store it.
 *
 * That narrows, but does not eliminate, what this workflow touches: the
 * message still passes through this server's memory and through the Paubox
 * Email API. A BAA is executed with Paubox for lifewellfhp.com (see P4-D3),
 * but nothing here constitutes or implies a broader compliance claim.
 */
export async function sendContactNotification(
  input: ContactInput,
  referenceId: string
): Promise<DeliveryResult> {
  const subject = input.subject
    ? `Website enquiry: ${input.subject}`
    : `Website enquiry from ${input.name}`;

  const text = [
    `New enquiry from the LifeWell website`,
    `Reference: ${referenceId}`,
    ``,
    `Name:    ${input.name}`,
    `Email:   ${input.email}`,
    `Phone:   ${input.phone || '—'}`,
    `Subject: ${input.subject || '—'}`,
    ``,
    `Message:`,
    input.message,
    ``,
    `— Sent from the contact form at lifewellfhp.com`,
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#374151;line-height:1.6">
      <h2 style="font-family:Georgia,serif;color:#2f6691;margin:0 0 4px">New website enquiry</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#5b6675">Reference ${escapeHtml(referenceId)}</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px">
        <tr><td style="padding:6px 16px 6px 0;color:#5b6675">Name</td><td style="padding:6px 0"><strong>${escapeHtml(input.name)}</strong></td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#5b6675">Email</td><td style="padding:6px 0"><a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#5b6675">Phone</td><td style="padding:6px 0">${escapeHtml(input.phone || '—')}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#5b6675">Subject</td><td style="padding:6px 0">${escapeHtml(input.subject || '—')}</td></tr>
      </table>
      <div style="border-left:3px solid #3e7fb1;padding:4px 0 4px 16px;white-space:pre-wrap">${escapeHtml(input.message)}</div>
      <p style="margin-top:24px;font-size:12px;color:#5b6675">Sent from the contact form at lifewellfhp.com</p>
    </div>
  `;

  const inbox = await resolveInboxEmail();

  if (!pauboxConfigured) {
    // Log-only mode. Never claim delivery that did not happen.
    logger.warn('Paubox API key is not configured — contact notification was not sent', {
      referenceId,
      hasSubject: Boolean(input.subject),
      messageLength: input.message.length,
    });
    if (isProduction) {
      throw serverError('Mail transport is not configured');
    }
    return { delivered: false, referenceId, inbox };
  }

  const result = await sendViaPauboxApi({
    to: { address: inbox },
    subject,
    text,
    html,
    // Lets the practice reply straight to the patient without exposing the
    // address as the envelope sender. input.name/input.email are already
    // control-character-stripped and email-format-validated by
    // contactSchema before they ever reach here.
    replyTo: { name: input.name, address: input.email },
  });

  if (!result.ok) {
    logger.error('Contact notification failed', {
      referenceId,
      httpStatus: result.httpStatus,
      reason: result.errorMessage,
    });
    throw serverError('Unable to deliver the message');
  }

  // A 2xx response only proves Paubox's API accepted the request — not that
  // it reached the final mailbox. Log exactly that, plus the non-sensitive
  // tracking id Paubox returns, so a future delivery question has more than
  // "the request didn't fail" to go on. No message content, no visitor
  // name/email/phone here.
  logger.info('Contact notification accepted by Paubox Email API', {
    referenceId,
    httpStatus: result.httpStatus,
    sourceTrackingId: result.sourceTrackingId,
  });
  return { delivered: true, referenceId, inbox };
}

export type OutboundMail = {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  html?: string;
  replyTo?: string;
};

export type OutboundResult = {
  delivered: boolean;
  error?: string;
};

/** Admin-composed or lead follow-up mail. Does not throw — caller logs status. */
export async function sendOutboundMail(input: OutboundMail): Promise<OutboundResult> {
  const text = input.body;
  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#374151;line-height:1.6">
      <div style="white-space:pre-wrap">${escapeHtml(input.body)}</div>
      <p style="margin-top:24px;font-size:12px;color:#5b6675">Sent from the LifeWell website control center.</p>
    </div>
  `;

  if (!pauboxConfigured) {
    const error = 'Paubox API key is not configured';
    logger.warn('Outbound mail skipped', { to: input.to, reason: error });
    return { delivered: false, error };
  }

  const result = await sendViaPauboxApi({
    to: { name: input.toName, address: input.to },
    subject: input.subject,
    text,
    html: input.html || html,
    replyTo: input.replyTo ? { address: input.replyTo } : undefined,
  });

  if (!result.ok) {
    const message = result.errorMessage || 'unknown';
    logger.error('Outbound mail failed', { to: input.to, reason: message });
    return { delivered: false, error: message };
  }

  // Same non-sensitive acceptance metadata as sendContactNotification, for
  // diagnostic parity between the two mail paths — no recipient address or
  // message content.
  logger.info('Outbound mail accepted by Paubox Email API', {
    httpStatus: result.httpStatus,
    sourceTrackingId: result.sourceTrackingId,
  });
  return { delivered: true };
}

/** Local dev only (never invoked on Vercel — see index.ts) — confirms the Paubox API key is present at boot. */
export async function verifyMailTransport(): Promise<void> {
  if (!pauboxConfigured) {
    logger.warn('Paubox API key not configured — contact form runs in log-only mode');
    return;
  }
  logger.info('Paubox Email API key configured');
}
