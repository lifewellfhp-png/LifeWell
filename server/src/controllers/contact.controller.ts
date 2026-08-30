import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { contactSchema, fieldErrors } from '../validation/schemas.js';
import { sendContactNotification, resolveInboxEmail } from '../services/email.service.js';
import { storeLead } from './leads.controller.js';
import { logEmailMessage } from '../lib/mailLog.js';
import { badRequest } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { supabaseConfigured } from '../lib/supabase.js';

/**
 * Builds the operational log body for a contact-form notification.
 * Deliberately takes only name/email/phone/referenceId as parameters — no
 * message/body text is accepted, so (like buildLeadInsertPayload in
 * leads.controller.ts) this function structurally cannot embed the
 * free-text message even if a future caller passed the wider `ContactInput`
 * object in by mistake. Exported so tests can prove this without a live
 * Supabase connection. See P4-B2.
 */
export function buildContactLogBody(input: {
  name: string;
  email: string;
  phone?: string;
  referenceId: string;
}): string {
  return [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone || '—'}`,
    `Reference: ${input.referenceId}`,
    '',
    '[Message content is not stored here. It was forwarded by email only — see the practice inbox notification for this reference.]',
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
  let leadStored = false;

  if (supabaseConfigured()) {
    try {
      // Deliberately omits parsed.data.message — see storeLead()'s doc
      // comment (P4-B2). The message is still forwarded by email below;
      // it is just never written to this table.
      await storeLead({
        type: 'contact',
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        subject: parsed.data.subject,
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

  // P4-B2: the logged body is operational metadata only — name/email/
  // phone/reference are already stored in `leads`, so this adds nothing
  // new. The free-text message itself is intentionally never included
  // here; it was already forwarded (or attempted) via SMTP above.
  await logEmailMessage({
    direction: 'inbound',
    from_email: parsed.data.email,
    from_name: parsed.data.name,
    to_email: result.inbox,
    to_name: 'LifeWell inbox',
    subject: parsed.data.subject || `Website enquiry from ${parsed.data.name}`,
    body: buildContactLogBody({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      referenceId,
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
