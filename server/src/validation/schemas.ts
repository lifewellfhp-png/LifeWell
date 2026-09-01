import { z } from 'zod';

/**
 * Authoritative request validation.
 *
 * The browser performs the same checks for immediate feedback, but these are
 * the ones that count — client-side validation is never trusted.
 */

/** Trimmed, length-bounded string carrying patient-facing messages. */
const trimmed = (min: number, max: number, tooShort: string, tooLong: string) =>
  z
    .string({ required_error: tooShort, invalid_type_error: tooShort })
    .transform((v) => v.trim())
    .pipe(z.string().min(min, tooShort).max(max, tooLong));

/**
 * Strips ASCII control characters (including CR and LF) so a crafted value
 * cannot inject extra headers into the notification email.
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const sanitise = (value: string) =>
  value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();

/**
 * P4-B4: the public Contact form is an administrative/non-clinical request
 * only. There is no free-text Subject or Message — the visitor picks from
 * this fixed allowlist, and nothing else is accepted. Labels are
 * server-controlled; a client never sends (or is trusted to send) display
 * text, only the machine-readable value below.
 */
export const CONTACT_REASONS = [
  'scheduling',
  'insurance_pricing',
  'existing_appointment',
  'billing_admin',
  'general_admin',
] as const;

export type ContactReason = (typeof CONTACT_REASONS)[number];

export const CONTACT_REASON_LABELS: Record<ContactReason, string> = {
  scheduling: 'Schedule an appointment',
  insurance_pricing: 'Insurance or pricing question',
  existing_appointment: 'Existing appointment question',
  billing_admin: 'Billing or administrative question',
  general_admin: 'General administrative question',
};

export const contactSchema = z
  .object({
    name: trimmed(
      2,
      100,
      'Please enter your full name.',
      'Please use 100 characters or fewer.'
    )
      .transform(sanitise)
      .refine((v) => v.length >= 2, { message: 'Please enter your full name.' }),

    email: z
      .string()
      .transform((v) => v.trim().toLowerCase())
      .pipe(z.string().email('Please enter a valid email address.').max(254)),

    phone: z
      .string()
      .transform((v) => v.trim())
      .pipe(
        z
          .string()
          .max(20)
          .regex(/^$|^[\d\s()+.\-]{7,20}$/, 'Please enter a valid phone number.')
      )
      .optional()
      .default(''),

    reason: z.enum(CONTACT_REASONS, {
      errorMap: () => ({ message: 'Please select a reason for contacting us.' }),
    }),

    consent: z.literal(true, {
      errorMap: () => ({ message: 'Please confirm before sending.' }),
    }),

    /** Honeypot — must be empty. */
    company: z.string().max(0).optional().default(''),
  })
  // P4-B4: strictly reject any unexpected field — including the legacy
  // visitor-written `subject`/`message` fields this form used to accept.
  // A caller posting the old payload shape directly to /api/contact (i.e.
  // bypassing the Client entirely) must not be able to smuggle free text
  // through; failing the whole request with a 400 is safer than silently
  // stripping unknown keys, since only this repo's own Client calls this
  // endpoint — there's no third-party integration whose compatibility a
  // strict rejection could break.
  .strict();

export type ContactInput = z.infer<typeof contactSchema>;

export const newsletterSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email('Please enter a valid email address.').max(254)),

  company: z.string().max(0).optional().default(''),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;

/** Flattens Zod issues into a field -> message map for the client. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = issue.message;
  }
  return out;
}
