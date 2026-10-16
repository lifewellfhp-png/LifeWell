import type { Request, Response } from 'express';
import { newsletterSchema, fieldErrors } from '../validation/schemas.js';
import { subscribe } from '../services/newsletter.service.js';
import { storeLead } from './leads.controller.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { writeAuditLog } from '../lib/audit.js';
import { badRequest } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { supabaseConfigured } from '../lib/supabase.js';

export async function handleNewsletter(req: Request, res: Response): Promise<void> {
  const parsed = newsletterSchema.safeParse(req.body);

  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);

    if ('company' in errors) {
      logger.warn('Newsletter honeypot triggered');
      res.status(201).json({ success: true, message: 'Thank you for subscribing.' });
      return;
    }

    throw badRequest(errors.email ?? 'Please enter a valid email address.', errors);
  }

  // Phase 1 item 7 — see contact.controller.ts's own comment for the
  // honeypot-then-Turnstile ordering rationale, and for why a misconfigured
  // secret gets its own audit log entry rather than being folded silently
  // into "verification passed."
  const turnstile = await verifyTurnstile(parsed.data.turnstile_token, req.ip);
  if (turnstile.misconfigured) {
    await writeAuditLog({
      action: 'turnstile_misconfigured',
      resource: 'turnstile',
      summary: 'Cloudflare Turnstile rejected a newsletter signup because the server secret is invalid — submissions are being accepted unverified until TURNSTILE_SECRET_KEY is fixed.',
      meta: { errorCodes: turnstile.errorCodes },
    });
  }
  if (!turnstile.ok) {
    throw badRequest('Verification failed. Please reload the page and try again.');
  }

  if (supabaseConfigured()) {
    try {
      await storeLead({
        type: 'newsletter',
        email: parsed.data.email,
        subject: 'Newsletter signup',
      });
    } catch (err) {
      logger.error('newsletter lead persist failed', {
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  const result = await subscribe(parsed.data.email);

  res.status(201).json({
    success: true,
    message: result.created
      ? 'Almost there — please check your inbox to confirm your subscription.'
      : 'You’re already subscribed. Thank you.',
  });
}
