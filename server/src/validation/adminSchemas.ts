import { z } from 'zod';

export function isPubliclyVisibleTestimonial(row: { published?: unknown; consent_confirmed?: unknown }): boolean {
  return row.published === true && row.consent_confirmed === true;
}

export function assertEffectiveTestimonialConsent(row: { published?: unknown; consent_confirmed?: unknown }): void {
  if (row.published === true && row.consent_confirmed !== true) {
    throw new Error('Published testimonials require consent_confirmed=true.');
  }
}

export const announcementCreate = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  tone: z.enum(['info', 'warning', 'urgent']).default('info'),
  active: z.boolean().default(true),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  sort_order: z.number().int().default(0),
});
export const announcementUpdate = announcementCreate.partial();

export const serviceCreate = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  summary: z.string().max(4000).optional().nullable(),
  body: z.string().max(50000).optional().nullable(),
  icon: z.string().max(200).optional().nullable(),
  image_url: z.string().max(1000).optional().nullable().or(z.literal('')),
  /**
   * Required on create — a new service must never be silently classified.
   * See mapServiceSummaries() (client) and the `services` beforeUpdate hook
   * (admin.routes.ts): an uncategorized row must never quietly become
   * MA/AZ-eligible ('psychiatric'). 'professional-education' (e.g. the
   * Preceptorship Program) is intentionally excluded from the MA/AZ
   * telehealth filter too — TelehealthStatePageContent only allowlists
   * 'psychiatric', so any other category (including this one) is excluded
   * by default with no extra filter changes needed.
   */
  category: z.enum(['psychiatric', 'primary-care', 'professional-education']),
  published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
});
export const serviceUpdate = serviceCreate.partial().extend({
  // Update stays lenient: category may be omitted (no change), a valid
  // value (explicit change), or null/'' (legacy rows with no category yet,
  // and the Admin form always resubmits every field — see the services
  // beforeUpdate hook, which strips a null/'' category rather than writing
  // it, so editing an unrelated field on an uncategorized legacy row can
  // never fail or accidentally clear a real value).
  category: z.preprocess(
    (v) => (v === '' ? null : v),
    z.enum(['psychiatric', 'primary-care', 'professional-education']).nullable().optional()
  ),
});

export const providerCreate = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  credentials: z.string().max(200).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  bio: z.string().max(20000).optional().nullable(),
  education: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  photo_url: z.string().max(1000).optional().nullable().or(z.literal('')),
  published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});
export const providerUpdate = providerCreate.partial();

export const insuranceCreate = z.object({
  name: z.string().min(1).max(200),
  logo_url: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  self_pay: z.boolean().default(false),
  published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});
export const insuranceUpdate = insuranceCreate.partial();

const testimonialBase = z.object({
  quote: z.string().min(1).max(2000),
  author_name: z.string().min(1).max(120),
  author_role: z.string().max(120).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  published: z.boolean().default(false),
  consent_confirmed: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export const testimonialCreate = testimonialBase.refine(
  (data: { published?: boolean; consent_confirmed?: boolean }) => !(data.published === true && data.consent_confirmed !== true),
  {
    message: 'Published testimonials require explicit consent_confirmed=true.',
    path: ['consent_confirmed'],
  }
);

export const testimonialUpdate = testimonialBase.partial().refine(
  (data: { published?: boolean; consent_confirmed?: boolean }) => !(data.published === true && data.consent_confirmed === false),
  {
    message: 'Published testimonials require consent_confirmed=true.',
    path: ['consent_confirmed'],
  }
);

/**
 * Phase 11 (FAQ Admin Governance Hardening): the exact category values
 * confirmed to be in current legitimate use in Production (verified via
 * the public content API before this change — General, Fees,
 * Appointments, nothing else). Narrowed from a free-text string
 * specifically because a category typo/casing slip (e.g. "fees" instead
 * of "Fees") is exactly the kind of silent, hard-to-notice mistake that
 * caused the real Production incident this phase addresses — a row with
 * a near-miss category value doesn't error, it just silently never
 * appears on the page an editor expects. Still `.nullable()` for
 * backward compatibility with any historical null-category row, but no
 * longer accepts arbitrary strings.
 */
export const FAQ_CATEGORIES = ['General', 'Fees', 'Appointments'] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const faqCreate = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(10000),
  category: z.enum(FAQ_CATEGORIES).optional().nullable(),
  published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});
export const faqUpdate = faqCreate.partial();

export const locationCreate = z.object({
  name: z.string().min(1).max(200),
  address_line1: z.string().max(200).optional().nullable(),
  address_line2: z.string().max(200).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(60).optional().nullable(),
  postal_code: z.string().max(30).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  hours: z.record(z.string()).default({}),
  is_primary: z.boolean().default(false),
  published: z.boolean().default(true),
});
export const locationUpdate = locationCreate.partial();

/**
 * Phase 12: `primary_cta_href`/`secondary_cta_href` on a telehealth state
 * page were free text with zero format validation, and
 * `secondary_cta_href` is rendered directly into a Next.js `<Link href>`
 * on the public page with no sanitization in between (client/src/
 * components/sections/TelehealthStatePageContent.tsx) — a value like
 * `javascript:...` would have been accepted end-to-end. Restricting to an
 * internal path (`/...`, explicitly excluding the protocol-relative `//`
 * form) or an absolute `https://` URL closes this off while still
 * allowing every legitimate use (linking to another page on this site, or
 * to an external https resource) unchanged.
 */
const safeInternalOrHttpsHref = z
  .string()
  .max(300)
  .optional()
  .nullable()
  .refine(
    (value) => {
      if (value == null || value === '') return true;
      if (value.startsWith('/') && !value.startsWith('//')) return true;
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Must be an internal path starting with / or a valid https:// URL.' }
  );

export const telehealthStateCreate = z.object({
  state_name: z.string().min(1).max(60),
  state_code: z.string().min(2).max(2),
  slug: z.string().min(1).max(60),
  published: z.boolean().default(true),
  badge: z.string().max(200).optional().nullable(),
  heading: z.string().max(200).optional().nullable(),
  subheading: z.string().max(300).optional().nullable(),
  body: z.string().max(4000).optional().nullable(),
  care_mode: z.string().max(200).optional().nullable(),
  /** 'existing' = keep whatever Florida's current insurance/self-pay structure is. 'self_pay_only' = self-pay only, no insurance claims. */
  insurance_mode: z.enum(['existing', 'self_pay_only']).default('self_pay_only'),
  self_pay_enabled: z.boolean().default(false),
  /** Never defaulted to a number — a real fee is only ever set by an admin entering one. */
  self_pay_fee: z.number().positive().optional().nullable(),
  self_pay_fee_label: z.string().max(120).optional().nullable(),
  pricing_note: z.string().max(300).optional().nullable(),
  hero_image_url: z.string().max(1000).optional().nullable(),
  hero_image_alt: z.string().max(300).optional().nullable(),
  primary_cta_label: z.string().max(80).optional().nullable(),
  primary_cta_href: safeInternalOrHttpsHref,
  secondary_cta_label: z.string().max(80).optional().nullable(),
  secondary_cta_href: safeInternalOrHttpsHref,
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  og_image_url: z.string().max(1000).optional().nullable(),
  sort_order: z.number().int().default(0),
});
export const telehealthStateUpdate = telehealthStateCreate.partial();

/**
 * Phase 12: matches the exact 8 values the Admin blog editor's own category
 * dropdown offers (admin/src/app/(app)/blog/page.tsx's CATEGORIES const).
 * Before this change the server accepted any string up to 80 chars — a
 * typo or a value never present in the Admin's own dropdown would save
 * successfully and just silently not match anything the dropdown itself
 * ever shows again, the same class of drift Phase 11 closed for FAQs.
 * Blank ('') from the dropdown's placeholder option means "no category" —
 * preprocessed to null, matching services' own category preprocessing
 * (see serviceUpdate above).
 */
export const BLOG_CATEGORIES = [
  'Anxiety',
  'Depression',
  'ADHD',
  'Psychiatric Care & Evaluations',
  'Medication & Treatment',
  'Sleep & Wellness',
  'Trauma & Stress',
  'Whole-Person Wellness',
] as const;
const blogCategorySchema = z.preprocess(
  (v) => (v === '' ? null : v),
  z.enum(BLOG_CATEGORIES).nullable().optional()
);

export const blogCreate = z.object({
  slug: z.string().min(1).max(160),
  title: z.string().min(1).max(300),
  excerpt: z.string().max(1000).optional().nullable(),
  body: z.string().max(100000).optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
  author_name: z.string().max(120).optional().nullable(),
  category: blogCategorySchema,
  // Validated against the live `services` table at request time (see
  // assertValidRelatedServiceSlug in admin.routes.ts) rather than a fixed
  // enum here, since valid slugs change whenever a service is added,
  // renamed, or removed — a hardcoded server-side list would drift from
  // the Admin's own dropdown (admin/src/app/(app)/blog/page.tsx's SERVICES
  // const) immediately.
  related_service_slug: z.string().max(160).optional().nullable(),
  published: z.boolean().default(true),
  published_at: z.string().datetime().optional().nullable(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  og_image_url: z.string().optional().nullable(),
});
export const blogUpdate = blogCreate.partial();

export const mediaCreate = z.object({
  title: z.string().min(1).max(200),
  url: z.string().min(1),
  alt_text: z.string().max(500).optional().nullable(),
  mime_type: z.string().max(120).optional().nullable(),
  width: z.number().int().optional().nullable(),
  height: z.number().int().optional().nullable(),
  folder: z.string().max(120).default('general'),
});
export const mediaUpdate = mediaCreate.partial();

/**
 * Only an https:// URL is ever accepted for a video (P4-E3) — rejects
 * javascript:, data:, blob:, protocol-relative, and malformed input by
 * construction, since `new URL()` throws on anything that isn't a
 * well-formed absolute URL and the protocol check excludes every
 * non-https scheme. No raw HTML is accepted for videos at all: the
 * `embed_html` field has been removed from this schema entirely, so a
 * request that includes it has that key silently dropped before it ever
 * reaches the database (see crudFactory.ts, which inserts/updates using
 * only `parsed.data`, never the raw request body) — not sanitized,
 * simply never accepted as a write target.
 */
const httpsUrl = z.string().max(2000).refine(
  (value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'Must be a valid https:// URL' }
);

const videoFields = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  provider: z.enum(['youtube', 'vimeo', 'file', 'embed']).default('youtube'),
  url: httpsUrl.optional().nullable().or(z.literal('')),
  thumbnail_url: httpsUrl.optional().nullable().or(z.literal('')),
  published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});
export const videoCreate = videoFields.refine((row) => Boolean(row.url && String(row.url).trim()), {
  message: 'Add a video URL',
  path: ['url'],
});
export const videoUpdate = videoFields.partial();

/**
 * Phase 12 (Admin Content Governance Audit): `site_sections.content` is a
 * generic, unstructured JSONB blob shared by every homepage/marketing
 * section AND by the `page_key:'fees', section_key:'self_pay'` row that
 * backs the /fees-insurance self-pay pricing table (client/src/lib/
 * cms-resolve.ts's mapFees(), which reads `content.psychiatricStatePricing`
 * and overrides client/src/data/pricing.ts's static Florida/Massachusetts/
 * Arizona figures whenever exactly 3 valid entries are present). Before
 * this change, `content` had zero validation of any kind — a typo'd,
 * negative, zero, or wildly-wrong-magnitude dollar amount, or a misspelled
 * state name, would publish immediately with no server-side check at all.
 *
 * This check is deliberately narrow: it only ever inspects a `content`
 * object that actually contains a `psychiatricStatePricing` key (any other
 * section's content, including one that happens to share the same generic
 * JSON field name for something else, is untouched), and it validates
 * *shape and sanity bounds*, not the specific approved dollar figures —
 * this preserves the Admin's existing ability to intentionally update
 * pricing through this CMS row (the dedicated FeesCopy admin UI exists
 * for exactly that), while closing the fat-finger/garbage-value failure
 * mode. A full read-only lock (matching telehealth_state_pages.self_pay_fee
 * /self_pay_fee_label's fully-static-only precedent, which the Phase 12
 * audit confirmed exists for the *separate* per-state telehealth pricing
 * fields) would be a materially different CMS-authority change and is
 * intentionally NOT made here without separate authorization — see the
 * Phase 12 report.
 */
export const PROTECTED_PRICING_STATES = ['Florida', 'Massachusetts', 'Arizona'] as const;
const PRICING_SANITY_CEILING = 2000;

export function validatePsychiatricStatePricingShape(content: unknown): string | null {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const pricing = (content as Record<string, unknown>).psychiatricStatePricing;
  if (pricing === undefined) return null; // this payload doesn't touch pricing at all
  if (!Array.isArray(pricing)) return 'psychiatricStatePricing must be a list of state pricing entries.';
  for (const entry of pricing) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return 'Each pricing entry must be an object with state, initialFee, and followUpFee.';
    }
    const { state, initialFee, followUpFee } = entry as Record<string, unknown>;
    if (typeof state !== 'string' || !(PROTECTED_PRICING_STATES as readonly string[]).includes(state)) {
      return `Each pricing entry's state must be one of: ${PROTECTED_PRICING_STATES.join(', ')}.`;
    }
    for (const [label, fee] of [
      ['initialFee', initialFee],
      ['followUpFee', followUpFee],
    ] as const) {
      if (typeof fee !== 'number' || !Number.isFinite(fee) || fee <= 0 || fee > PRICING_SANITY_CEILING) {
        return `${state} ${label} must be a positive dollar amount no greater than $${PRICING_SANITY_CEILING}.`;
      }
    }
  }
  return null;
}

const sectionBase = z.object({
  page_key: z.string().min(1).max(80),
  section_key: z.string().min(1).max(80),
  title: z.string().max(200).optional().nullable(),
  content: z.record(z.unknown()).default({}),
  published: z.boolean().default(true),
});

function withPricingGuard<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const content = (data as { content?: unknown }).content;
    const error = validatePsychiatricStatePricingShape(content);
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: ['content'] });
    }
  });
}

export const sectionCreate = withPricingGuard(sectionBase);
export const sectionUpdate = withPricingGuard(sectionBase.partial());

/**
 * Phase 12: `booking_url` is the CharmHealth calendar iframe's `src`. Before
 * this change, the server accepted any `z.string().url()` (any scheme,
 * any host) — the only thing standing between an Admin typo/mistake and a
 * live public iframe pointed at an arbitrary URL was a client-side check
 * (client/src/lib/cms-resolve.ts's calendarEmbedUrl()) that does a raw
 * substring test (`/charmtracker\.com|clientsecure\.me/i.test(url)`)
 * rather than parsing the actual hostname — a value merely *containing*
 * one of those substrings anywhere (not necessarily as its real host)
 * would pass that check. Validating the real hostname server-side closes
 * this regardless of what the client-side fallback does, and matches the
 * https-only precedent already established for video URLs (see httpsUrl
 * above).
 */
const ALLOWED_BOOKING_HOSTS = ['charmtracker.com', 'clientsecure.me'];
function isAllowedBookingHost(hostname: string): boolean {
  return ALLOWED_BOOKING_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
const bookingUrlSchema = z.string().max(2000).refine(
  (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && isAllowedBookingHost(url.hostname);
    } catch {
      return false;
    }
  },
  { message: 'Booking URL must be an https:// link to the approved booking provider (charmtracker.com or clientsecure.me).' }
);

export const bookingCreate = z.object({
  label: z.string().min(1).max(120).default('Book appointment'),
  booking_url: bookingUrlSchema,
  provider: z.string().max(80).default('charmhealth'),
  active: z.boolean().default(true),
});
export const bookingUpdate = bookingCreate.partial();

export const seoCreate = z.object({
  path: z.string().min(1).max(300),
  title: z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  og_image_url: z.string().optional().nullable(),
  noindex: z.boolean().default(false),
});
export const seoUpdate = seoCreate.partial();

export const leadUpdate = z.object({
  status: z.enum(['new', 'open', 'replied', 'closed', 'spam']).optional(),
  subject: z.string().max(200).optional().nullable(),
});

export const adminUserCreate = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(['staff']).default('staff'),
  password: z.string().min(10).max(128),
  permissions: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export const adminUserUpdate = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(10).max(128).optional(),
  permissions: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Strong policy for self-service password changes (changePasswordSchema
 * below) — deliberately stricter than adminUserCreate/adminUserUpdate's
 * min(10), which cover admin-set temporary passwords for other accounts.
 */
const strongPassword = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128)
  .refine((v) => /[a-z]/.test(v), 'Password must include a lowercase letter.')
  .refine((v) => /[A-Z]/.test(v), 'Password must include an uppercase letter.')
  .refine((v) => /[0-9]/.test(v), 'Password must include a number.')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Password must include a symbol.');

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required.'),
    new_password: strongPassword,
    confirm_password: z.string().min(1, 'Please confirm the new password.'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'New password and confirmation do not match.',
    path: ['confirm_password'],
  });

export const sendCredentialsSchema = z.object({
  password: z.string().min(10).max(128).optional(),
  admin_url: z.string().url().optional(),
});

/**
 * Shared closed vocabulary for coarse, privacy-safe device classification —
 * reused by both analyticsIngestSchema (page views) and
 * conversionIngestSchema (Phase 8 P3-1) so the two event types can never
 * drift into divergent device categories.
 */
const deviceCategorySchema = z.enum(['mobile', 'tablet', 'desktop', 'unknown']);

export const analyticsIngestSchema = z.object({
  event_type: z.enum(['page_view', 'session_start', 'outbound_click']),
  path: z.string().max(500).optional(),
  referrer_host: z.string().max(200).optional().nullable(),
  device: deviceCategorySchema.default('unknown'),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
});

export const conversionIngestSchema = z.object({
  conversion_type: z.enum(['contact', 'newsletter', 'booking_click']),
  path: z.string().max(500).optional().nullable(),
  meta: z.record(z.unknown()).default({}),
  /**
   * Phase 8 P3-1: optional, privacy-minimized attribution, same shape as
   * page views. `device` is validated by the shared enum above; the raw
   * `referrer_host` string is re-validated/normalized server-side by
   * normalizeReferrerHost() in handleConversionIngest — this schema only
   * bounds its length as a first-pass filter, the same way
   * analyticsIngestSchema.referrer_host does.
   */
  device: deviceCategorySchema.optional(),
  referrer_host: z.string().max(253).optional().nullable(),
});

export const emailSendSchema = z.object({
  to: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().max(120).optional(),
        lead_id: z.string().uuid().optional(),
      })
    )
    .min(1)
    .max(50),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
});

export const settingsUpdate = z.object({
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  heading_font: z.enum(['Lora', 'Georgia', 'Playfair Display']).optional(),
  body_font: z.enum(['Source Sans 3', 'Inter', 'system-ui']).optional(),
  header_cta_label: z.string().min(1).max(80).optional(),
  header_cta_url: z.string().min(1).max(500).optional(),
  logo_url: z.string().max(1000).optional().nullable(),
  practice_phone: z.string().max(40).optional().nullable(),
  practice_email: z.string().email().optional().nullable().or(z.literal('')),
  inbox_email: z.string().email().optional().nullable().or(z.literal('')),
});

// ---------------------------------------------------------------------------
// Marketing contacts (P4-I2C). A marketing directory, NOT a clinical patient
// database — see server/supabase/ops.sql's P4-I2A migration for the full
// data-minimization rationale this mirrors. `.strict()` rejects any
// unrecognized key outright (the same choice P4-B4 made for the public
// Contact form), so a caller cannot slip an arbitrary clinical/free-text
// field through validation.
// ---------------------------------------------------------------------------

export const MARKETING_AUDIENCE_TYPES = ['existing_patient', 'prospective_patient', 'subscriber', 'other'] as const;
export const MARKETING_SOURCES = ['manual', 'csv_import', 'website_signup', 'other'] as const;
export const MARKETING_STATUSES = ['pending', 'subscribed', 'unsubscribed', 'suppressed'] as const;
// Small, operational, non-clinical set. `other` is a literal controlled
// value — no accompanying free-text explanation field exists, so a caller
// can never smuggle arbitrary text through this column.
export const MARKETING_SUPPRESSION_REASONS = ['hard_bounce', 'spam_complaint', 'administrative', 'other'] as const;

export type MarketingAudienceType = (typeof MARKETING_AUDIENCE_TYPES)[number];
export type MarketingSource = (typeof MARKETING_SOURCES)[number];
export type MarketingStatus = (typeof MARKETING_STATUSES)[number];

// 254 is the practical maximum total email address length (RFC 5321/5322).
// Exported so the CSV import path (P4-I2E) validates each row's email with
// the exact same rule as manual create/update, rather than a re-typed copy.
export const marketingContactEmail = z.string().trim().min(1).max(254).email();

const marketingContactBase = z.object({
  email: marketingContactEmail,
  first_name: z.string().trim().max(120).optional().nullable(),
  last_name: z.string().trim().max(120).optional().nullable(),
  // Segmentation only — must never be read as implying marketing consent.
  audience_type: z.enum(MARKETING_AUDIENCE_TYPES).default('other'),
  source: z.enum(MARKETING_SOURCES).default('manual'),
  marketing_status: z.enum(MARKETING_STATUSES).default('pending'),
  // Reuses the same controlled vocabulary as `source`, matching the DB
  // migration's own choice not to invent a second enum.
  consent_source: z.enum(MARKETING_SOURCES).optional().nullable(),
  consent_at: z.string().datetime().optional().nullable(),
  unsubscribed_at: z.string().datetime().optional().nullable(),
  suppressed_at: z.string().datetime().optional().nullable(),
  suppression_reason: z.enum(MARKETING_SUPPRESSION_REASONS).optional().nullable(),
});
// Deliberately no `id`, `email_normalized`, `created_at`, or `updated_at`
// field anywhere above — combined with `.strict()` below, this means a
// caller-supplied value for any of those is rejected outright at parse
// time, not merely ignored. `email_normalized` remains exclusively
// Postgres-generated (see the P4-I2A migration).

export const marketingContactCreate = marketingContactBase.strict().refine(
  (data) => !(data.marketing_status === 'subscribed' && !data.consent_source),
  {
    message: 'A contact cannot be created as subscribed without a consent_source.',
    path: ['consent_source'],
  }
);

export const marketingContactUpdate = marketingContactBase
  .strict()
  .partial()
  .refine((data) => !(data.marketing_status === 'subscribed' && data.consent_source === null), {
    message: 'consent_source cannot be explicitly cleared while setting marketing_status to subscribed.',
    path: ['consent_source'],
  });

/**
 * Effective-row consent invariant, mirroring assertEffectiveTestimonialConsent
 * (P4-G6): the PATCH payload alone can look fine while the row it produces
 * (merged with the existing stored values) is not. Called by the controller
 * after fetching the current row, not by the schema itself.
 */
export function assertEffectiveMarketingConsent(row: {
  marketing_status?: unknown;
  consent_source?: unknown;
}): void {
  if (row.marketing_status === 'subscribed' && !row.consent_source) {
    throw new Error('A contact cannot be subscribed without a consent_source.');
  }
}

const MARKETING_STATUS_TRANSITION_REJECTIONS = new Set([
  // Generic PATCH must never reactivate an opt-out — only a future,
  // explicit resubscription workflow (not built in this phase) may do so.
  'unsubscribed->subscribed',
  'suppressed->subscribed',
  // Weakens an opt-out back toward a sendable-adjacent state.
  'unsubscribed->pending',
  'suppressed->pending',
  // Do not casually weaken a stronger suppression down to a plain
  // unsubscribe; no repository/product evidence justifies allowing this
  // through the generic endpoint.
  'suppressed->unsubscribed',
]);

/**
 * Sticky unsubscribe/suppression invariant (P4-I2C). Every other directed
 * transition between the four statuses — including unsubscribed->suppressed
 * (allowed) and every transition away from `subscribed` — is permitted.
 */
export function assertMarketingStatusTransition(before: string, next: string): void {
  if (before === next) return;
  if (MARKETING_STATUS_TRANSITION_REJECTIONS.has(`${before}->${next}`)) {
    throw new Error(`Cannot change marketing_status from ${before} to ${next} through this endpoint.`);
  }
}

// ---------------------------------------------------------------------------
// Marketing contact resubscription (P4-I3). A deliberately separate,
// explicit-confirmation-only path for the one transition generic PATCH
// (assertMarketingStatusTransition above) permanently refuses:
// unsubscribed -> subscribed. `confirm` must be the literal boolean `true`
// — not merely truthy — so the server itself enforces that an affirmative
// attestation was actually sent, rather than trusting the Admin UI's
// checkbox alone.
// ---------------------------------------------------------------------------

export const marketingContactResubscribeSchema = z
  .object({
    confirm: z.literal(true),
  })
  .strict();

// ---------------------------------------------------------------------------
// Marketing campaign drafts (P4-I4B). Mirrors marketing_campaigns (P4-I4A,
// Production-verified). Draft management only — no delivery/schedule/send
// status exists. `.strict()` means status/created_by/created_at/updated_at/
// archived_at are structurally impossible for a caller to set: they simply
// are not fields on this schema, on Create or Update.
// ---------------------------------------------------------------------------

export const MARKETING_CAMPAIGN_STATUSES = ['draft', 'archived'] as const;
export type MarketingCampaignStatus = (typeof MARKETING_CAMPAIGN_STATUSES)[number];

/**
 * A trimmed, nonblank, length-bounded, single-line string. Applied to both
 * `name` (an internal label — no functional email-header risk, but a
 * newline-free single-line value is still the right shape for a table
 * column) and `subject` (a future email subject line, where CR/LF
 * rejection is a real email-header-injection safeguard, not just cosmetic).
 */
const singleLine = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`)
    .refine((v) => !/[\r\n]/.test(v), { message: `${label} cannot contain line breaks.` });

const marketingCampaignBase = z.object({
  name: singleLine(200, 'Campaign name'),
  subject: singleLine(200, 'Subject'),
  preview_text: z
    .string()
    .max(500, 'Preview text must be 500 characters or fewer.')
    .refine((v) => !/[\r\n]/.test(v), { message: 'Preview text cannot contain line breaks.' })
    .optional()
    .nullable(),
  // Multi-line plain-text body — only outer whitespace is trimmed, internal
  // line breaks are preserved. No CR/LF restriction (unlike name/subject/
  // preview_text) and no upper length bound, matching the P4-I4A DB check
  // (nonblank only).
  content: z.string().trim().min(1, 'Content is required.'),
  audience_type: z.enum(MARKETING_AUDIENCE_TYPES).optional().nullable(),
  /**
   * Optional rich HTML alternative to `content`. May contain the
   * `{{first_name_or_there}}` personalization token — substituted, HTML-
   * escaped, per recipient at render time (see
   * marketingCampaignDelivery.service.ts). No CR/LF restriction and no
   * upper length bound, matching `content`'s own shape — this is markup,
   * not a header value.
   */
  html_body: z.string().trim().optional().nullable(),
  /**
   * Exact subject line to use when a recipient has no usable first name.
   * Same header-injection safety as `subject` (single line, bounded).
   */
  subject_fallback: z
    .string()
    .max(200, 'Fallback subject must be 200 characters or fewer.')
    .refine((v) => !/[\r\n]/.test(v), { message: 'Fallback subject cannot contain line breaks.' })
    .optional()
    .nullable(),
});

export const marketingCampaignCreate = marketingCampaignBase.strict();
export const marketingCampaignUpdate = marketingCampaignBase.strict().partial();

/**
 * Campaign send confirmation (P4-I5B). `.strict()` + a literal-`true`
 * `confirm` means the request can carry no campaign content at all — the
 * server always uses the already-persisted campaign row, never anything
 * from this request body.
 */
export const marketingCampaignSendSchema = z
  .object({
    confirm: z.literal(true),
  })
  .strict();

/**
 * Campaign test-send (campaign management + safe test send). A single
 * real email address only — no array, no CC/BCC field exists on this
 * schema at all, so a caller cannot smuggle in extra recipients. `confirm`
 * mirrors marketingCampaignSendSchema's own explicit-attestation shape.
 * `first_name` is optional, in-memory-only test personalization input —
 * it is never looked up against or written to marketing_contacts.
 */
export const marketingCampaignTestSendSchema = z
  .object({
    email: z.string().trim().email('A valid email address is required.').max(320),
    first_name: z
      .string()
      .trim()
      .max(60, 'Test first name must be 60 characters or fewer.')
      .optional()
      .nullable(),
    confirm: z.literal(true),
  })
  .strict();

// ---------------------------------------------------------------------------
// Marketing contacts CSV import (P4-I2E). Two-stage: an in-memory
// preview/classify step that never writes to the database, followed by a
// separate confirm step gated on a server-signed token — see
// server/src/lib/marketingImportToken.ts and
// server/src/controllers/marketingContactsImport.controller.ts.
// ---------------------------------------------------------------------------

export const marketingContactsImportPreviewSchema = z
  .object({
    // Raw CSV text, not base64 — CSV is already plain UTF-8 text, so
    // encoding it would only add overhead. Generously bounded here; the
    // authoritative 5 MB byte-length limit is enforced in the controller
    // (this char-count max is just an outer backstop before parsing runs).
    csv: z.string().min(1).max(6_000_000),
  })
  .strict();

export const marketingContactsImportConfirmSchema = z
  .object({
    preview_token: z.string().min(1).max(3_000_000),
  })
  .strict();

export const DEFAULT_SITE_SETTINGS = {
  id: 'default',
  primary_color: '#3E7FB1',
  accent_color: '#5FAF6B',
  heading_font: 'Lora',
  body_font: 'Source Sans 3',
  header_cta_label: 'Book an Appointment',
  header_cta_url: '/book-telehealth-mental-health-appointment#charm-calendar',
  logo_url: null as string | null,
  practice_phone: null as string | null,
  practice_email: null as string | null,
  inbox_email: null as string | null,
};
