import type { Request, Response } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';
import { emailSendSchema } from '../validation/adminSchemas.js';
import { sendOutboundMail, resolveInboxEmail } from '../services/email.service.js';
import { writeAuditLog } from '../lib/audit.js';
import { writeNotification, isMissingTable } from '../lib/notify.js';
import { logEmailMessage } from '../lib/mailLog.js';
import { env, mailConfigured } from '../config/env.js';
import type { AuthedRequest } from '../middleware/adminAuth.js';

export async function getMailConfig(_req: Request, res: Response): Promise<void> {
  const inbox = await resolveInboxEmail();
  res.json({
    success: true,
    data: {
      configured: mailConfigured,
      provider: env.PAUBOX_API_KEY ? 'paubox' : mailConfigured ? 'smtp-fallback' : 'none',
      from: 'LifeWell Family Health & Psychiatry <contact@lifewellfhp.com>',
      smtp_user: env.SMTP_USER || null,
      smtp_host: env.SMTP_HOST || null,
      smtp_port: env.SMTP_PORT || null,
      inbox,
    },
  });
}

export async function listEmails(req: Request, res: Response): Promise<void> {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const direction = typeof req.query.direction === 'string' ? req.query.direction : undefined;
  let query = getSupabase().from('email_messages').select('*').order('created_at', { ascending: false }).limit(200);
  if (status) query = query.eq('status', status);
  if (direction === 'inbound' || direction === 'outbound') {
    query = query.eq('direction', direction);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error) || /direction/i.test(error.message)) {
      let fallback = getSupabase().from('email_messages').select('*').order('created_at', { ascending: false }).limit(200);
      if (status) fallback = fallback.eq('status', status);
      const retry = await fallback;
      if (retry.error) {
        if (isMissingTable(retry.error)) {
          res.json({ success: true, data: [] });
          return;
        }
        throw badRequest(retry.error.message);
      }
      const rows = (retry.data || []).map((row) => ({
        ...row,
        direction: row.sent_by ? 'outbound' : 'inbound',
        from_email: row.from_email || row.sent_by_email || null,
      }));
      const filtered =
        direction === 'inbound'
          ? rows.filter((row) => row.direction === 'inbound')
          : direction === 'outbound'
            ? rows.filter((row) => row.direction === 'outbound')
            : rows;
      res.json({ success: true, data: filtered });
      return;
    }
    throw badRequest(error.message);
  }
  res.json({ success: true, data });
}

export async function sendAdminEmails(req: Request, res: Response): Promise<void> {
  const parsed = emailSendSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Please add at least one recipient, a subject, and a message.');

  const actor = (req as AuthedRequest).admin;
  const results: { email: string; status: 'sent' | 'failed'; error?: string }[] = [];

  for (const recipient of parsed.data.to) {
    const result = await sendOutboundMail({
      to: recipient.email,
      toName: recipient.name,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    const status = result.delivered ? 'sent' : 'failed';
    results.push({ email: recipient.email, status, error: result.error });

    await logEmailMessage({
      direction: 'outbound',
      from_email: 'contact@lifewellfhp.com',
      from_name: 'LifeWell Family Health & Psychiatry',
      to_email: recipient.email,
      to_name: recipient.name ?? null,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status,
      error: result.error ?? null,
      lead_id: recipient.lead_id ?? null,
      sent_by: actor?.sub ?? null,
      sent_by_email: actor?.email ?? null,
    });
  }

  const sent = results.filter((row) => row.status === 'sent').length;
  const failed = results.length - sent;

  await writeAuditLog({
    actor,
    action: 'create',
    resource: 'emails',
    summary: `Sent ${sent} email${sent === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}: ${parsed.data.subject}`,
  });
  await writeNotification({
    type: 'email',
    audience: 'all',
    title: failed ? `Email send finished with ${failed} failure${failed === 1 ? '' : 's'}` : `Email sent: ${parsed.data.subject}`,
    body: `${sent} delivered · ${failed} failed`,
    href: '/emails',
  });

  res.json({ success: true, data: results });
}
