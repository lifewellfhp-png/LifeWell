import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { contactSchema, fieldErrors, CONTACT_REASON_LABELS } from '../validation/schemas.js';
import { sendContactNotification, resolveInboxEmail } from '../services/email.service.js';
import { storeLead } from './leads.controller.js';
import { logEmailMessage } from '../lib/mailLog.js';
import { badRequest } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { supabaseConfigured } from '../lib/supabase.js';

/**
 * Builds the operational log body for a contact-form notification.
 * Deliberately takes only name/email/phone/referenceId/reasonLabel as
 * parameters — no free-text message/subject is accepted, so (like
 * buildLeadInsertPayload in leads.controller.ts) this function structurally
 * cannot embed visitor-written narrative even if a future caller passed a
 * wider object in by mistake. reasonLabel is always a value looked up from
 * CONTACT_REASON_LABELS, never visitor-supplied text. Exported so tests can
 * prove this without a live Supabase connection. See P4-B2/P4-B3/P4-B4.
 */
export function buildContactLogBody(input: {
  name: string;
  email: string;
  phone?: string;
  referenceId: string;
  reasonLabel: string;
}): string {
  return [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone || '—'}`,
    `Reason: ${input.reasonLabel}`,
    `Reference: ${input.referenceId}`,
    '',
    'This is an administrative contact request submitted through the website. No free-text message was collected.',
  ].join('\n');
}

export async function handleContact(req: Request, res: Response): Promise<void> {
  const parsed = contactSchema.safeParse(req.body);

  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);

    // A filled honeypot means a bot. Return the normal success shape so the
    // sender learns nothing, but do no work.
    if ('company' in errors) {
      logger.warn('Contact honeypot triggered');
      res.status(201).json({
        success: true,
        message: 'Thank you — your message has been received.',
      });
      return;
    }

    throw badRequest('Please correct the highlighted fields and try again.', errors);
  }

  const referenceId = randomUUID().slice(0, 8).toUpperCase();
  const reasonLabel = CONTACT_REASON_LABELS[parsed.data.reason];
  let leadStored = false;

  if (supabaseConfigured()) {
    try {
      // P4-B2/P4-B4: no visitor-written free text exists anymore — subject
      // here is the server-controlled reason label, never visitor input.
      await storeLead({
        type: 'contact',
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        subject: reasonLabel,
        reference_id: referenceId,
      });
      leadStored = true;
    } catch (err) {
      logger.error('lead persist failed', {
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  let result;
  try {
    result = await sendContactNotification(parsed.data, referenceId);
  } catch (err) {
    logger.error('contact email failed', {
      referenceId,
      leadStored,
      reason: err instanceof Error ? err.message : 'unknown',
    });
    if (!leadStored) throw err;
    result = {
      delivered: false,
      referenceId,
      inbox: await resolveInboxEmail(),
    };
  }

  // P4-B2/P4-B4: the logged body is operational metadata only — name/email/
  // phone/reason/reference are already stored in `leads`, so this adds
  // nothing new. There is no free-text message or subject to include; the
  // form no longer collects either.
  await logEmailMessage({
    direction: 'inbound',
    from_email: parsed.data.email,
    from_name: parsed.data.name,
    to_email: result.inbox,
    to_name: 'LifeWell inbox',
    subject: `Website contact: ${reasonLabel}`,
    body: buildContactLogBody({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      referenceId,
      reasonLabel,
    }),
    status: result.delivered ? 'sent' : 'failed',
    error: result.delivered ? null : 'SMTP did not accept the message',
  });

  res.status(201).json({
    success: true,
    message: result.delivered
      ? 'Your message has been sent. We aim to respond within one business day.'
      : 'Your message has been received. We aim to respond within one business day.',
    referenceId,
  });
}
