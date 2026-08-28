import { z } from 'zod';

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
  category: z.enum(['psychiatric', 'primary-care']).optional().nullable(),
  published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
});
export const serviceUpdate = serviceCreate.partial();

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

export const testimonialCreate = z.object({
  quote: z.string().min(1).max(2000),
  author_name: z.string().min(1).max(120),
  author_role: z.string().max(120).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  published: z.boolean().default(true),
  consent_confirmed: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});
export const testimonialUpdate = testimonialCreate.partial();

export const faqCreate = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(10000),
  category: z.string().max(120).optional().nullable(),
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

export const blogCreate = z.object({
  slug: z.string().min(1).max(160),
  title: z.string().min(1).max(300),
  excerpt: z.string().max(1000).optional().nullable(),
  body: z.string().max(100000).optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
  author_name: z.string().max(120).optional().nullable(),
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

const videoFields = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  provider: z.enum(['youtube', 'vimeo', 'file', 'embed']).default('youtube'),
  url: z.string().max(2000).optional().nullable().or(z.literal('')),
  embed_html: z.string().max(10000).optional().nullable(),
  thumbnail_url: z.string().optional().nullable(),
  published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});
export const videoCreate = videoFields.refine(
  (row) => Boolean((row.url && String(row.url).trim()) || (row.embed_html && String(row.embed_html).trim())),
  {
    message: 'Add a video URL or embed HTML',
    path: ['url'],
  }
);
export const videoUpdate = videoFields.partial();

export const sectionCreate = z.object({
  page_key: z.string().min(1).max(80),
  section_key: z.string().min(1).max(80),
  title: z.string().max(200).optional().nullable(),
  content: z.record(z.unknown()).default({}),
  published: z.boolean().default(true),
});
export const sectionUpdate = sectionCreate.partial();

export const bookingCreate = z.object({
  label: z.string().min(1).max(120).default('Book appointment'),
  booking_url: z.string().url(),
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

export const sendCredentialsSchema = z.object({
  password: z.string().min(10).max(128).optional(),
  admin_url: z.string().url().optional(),
});

export const analyticsIngestSchema = z.object({
  event_type: z.enum(['page_view', 'session_start', 'outbound_click']),
  path: z.string().max(500).optional(),
  referrer_host: z.string().max(200).optional().nullable(),
  device: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).default('unknown'),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
});

export const conversionIngestSchema = z.object({
  conversion_type: z.enum(['contact', 'newsletter', 'booking_click']),
  path: z.string().max(500).optional().nullable(),
  meta: z.record(z.unknown()).default({}),
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
