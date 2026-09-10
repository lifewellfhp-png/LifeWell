import { Router } from 'express';
import { asyncHandler, adminLoginLimiter, changePasswordLimiter, marketingCampaignTestSendLimiter } from '../middleware/index.js';
import {
  requireAdmin,
  requirePermission,
  requireAnyPermission,
  requireSuperAdmin,
  type AuthedRequest,
} from '../middleware/adminAuth.js';
import { createCrudRouter } from './crudFactory.js';
import {
  handleAdminLogin,
  handleAdminMe,
  handleChangePassword,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  sendStaffCredentials,
  listAuditLogs,
} from '../controllers/adminAuth.controller.js';
import {
  listLeads,
  getLead,
  updateLead,
  deleteLead,
} from '../controllers/leads.controller.js';
import {
  getAnalyticsSummary,
} from '../controllers/analytics.controller.js';
import { handleMediaUpload } from '../controllers/media.controller.js';
import { listNotifications, markNotificationsRead } from '../controllers/notifications.controller.js';
import { listEmails, sendAdminEmails, getMailConfig } from '../controllers/emails.controller.js';
import { getSiteSettings, updateSiteSettings } from '../controllers/settings.controller.js';
import { importLiveWebsiteContent } from '../controllers/importLive.controller.js';
import {
  listMarketingContacts,
  getMarketingContact,
  createMarketingContact,
  updateMarketingContact,
  resubscribeMarketingContact,
} from '../controllers/marketingContacts.controller.js';
import {
  previewMarketingContactsImport,
  confirmMarketingContactsImport,
} from '../controllers/marketingContactsImport.controller.js';
import {
  listMarketingCampaigns,
  getMarketingCampaign,
  createMarketingCampaign,
  updateMarketingCampaign,
  archiveMarketingCampaign,
  previewMarketingCampaignRecipients,
  deleteMarketingCampaign,
  duplicateMarketingCampaign,
} from '../controllers/marketingCampaigns.controller.js';
import { sendMarketingCampaign, sendTestMarketingCampaign } from '../services/marketingCampaignDelivery.service.js';
import { getSupabase } from '../lib/supabase.js';
import { badRequest, AppError } from '../utils/errors.js';

/**
 * home/stats governance (P3-E2): a stat item explicitly marked
 * `requiresVerification: true` must never become publicly visible through
 * this route, regardless of what `hidden` value was submitted alongside
 * it — the only way to make it visible is to remove the requiresVerification
 * flag itself first, a separate, deliberate, visible admin action.
 *
 * No verified/approved completion state exists anywhere in the current
 * data model, so this does not invent one: an item marked
 * requiresVerification is treated as permanently non-public until that
 * flag is explicitly cleared, not "pending approval" in some other sense.
 *
 * Scoped narrowly to page_key:'home', section_key:'stats' — every other
 * page/section this shared `/sections` route serves (hero, welcome,
 * fees copy, etc.) passes through untouched. Detection relies on the
 * submitted payload including page_key/section_key, which the actual
 * Admin stats editor always sends (see admin/src/components/HomepageCopy.tsx);
 * a raw API call that PATCHes only `content` without repeating those two
 * identifying fields would not be caught by this guard.
 */
export function enforceStatsVerificationGate(data: Record<string, unknown>): Record<string, unknown> {
  if (data.page_key !== 'home' || data.section_key !== 'stats') return data;
  const content = data.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return data;
  const items = (content as Record<string, unknown>).items;
  if (!Array.isArray(items)) return data;
  const guardedItems = items.map((item) => {
    if (item && typeof item === 'object' && (item as Record<string, unknown>).requiresVerification === true) {
      return { ...(item as Record<string, unknown>), hidden: true };
    }
    return item;
  });
  return { ...data, content: { ...(content as Record<string, unknown>), items: guardedItems } };
}
import {
  announcementCreate,
  announcementUpdate,
  serviceCreate,
  serviceUpdate,
  providerCreate,
  providerUpdate,
  insuranceCreate,
  insuranceUpdate,
  testimonialCreate,
  testimonialUpdate,
  faqCreate,
  faqUpdate,
  locationCreate,
  locationUpdate,
  telehealthStateCreate,
  telehealthStateUpdate,
  blogCreate,
  blogUpdate,
  mediaCreate,
  mediaUpdate,
  videoCreate,
  videoUpdate,
  sectionCreate,
  sectionUpdate,
  bookingCreate,
  bookingUpdate,
  seoCreate,
  seoUpdate,
} from '../validation/adminSchemas.js';

export const adminRouter: Router = Router();

/**
 * Every response under /api/admin is private and must never be cached — by
 * the browser, a shared/corporate proxy, or a CDN — regardless of whether
 * the request succeeds, fails auth, fails authorization, or errors.
 * Registered first, before any route, so it applies universally: this is
 * what makes it cover /auth/login (which sits outside requireAdmin) and
 * every error response, not just successful authenticated reads (P4-G4B1).
 */
adminRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

adminRouter.post('/auth/login', adminLoginLimiter, asyncHandler(handleAdminLogin));
adminRouter.get('/auth/me', requireAdmin, asyncHandler(handleAdminMe));
adminRouter.post(
  '/auth/change-password',
  requireAdmin,
  changePasswordLimiter,
  asyncHandler(handleChangePassword)
);

/**
 * Phase 8 P1-1: friendly display labels for the Dashboard's "Booking Intent
 * by Page" breakdown below. Covers the well-known canonical routes, using
 * the SAME wording already established in client/src/data/navigation.ts —
 * no shared code exists between server/ and client/ (separate deployments),
 * so this intentionally duplicates only that small, stable set of labels
 * rather than inventing new wording or importing across the deployment
 * boundary. Any path not covered here (individual service/condition pages,
 * anything future) falls through to friendlyBookingPageLabel()'s
 * conservative humanized fallback below — never collapsed into a shared
 * bucket, so distinct pages always stay individually distinguishable.
 */
export const BOOKING_PATH_LABELS: Record<string, string> = {
  '/': 'Homepage',
  '/fees-insurance': 'Fees & Insurance',
  '/our-services': 'Our Services',
  '/bio': 'Provider',
  '/new-patients': 'New Patients',
  '/contact-telehealth-mental-health-provider': 'Contact',
  '/telehealth-mental-health-testimonials': 'Testimonials',
  '/book-telehealth-mental-health-appointment': 'Booking Page',
  '/orlando-psychiatric-care': 'Orlando Office',
  '/faqs': 'FAQs',
  '/blog': 'Blog',
  '/videos': 'Videos',
};

/** The three telehealth state pages actually defined in client/src/data/telehealth-states.ts. */
const TELEHEALTH_STATE_LABELS: Record<string, string> = {
  florida: 'Florida Telehealth',
  massachusetts: 'Massachusetts Telehealth',
  arizona: 'Arizona Telehealth',
};

/** Hyphenated-slug -> Title Case, e.g. "medication-management" -> "Medication Management". */
function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolves a stored conversions.path to a friendly, human-readable label —
 * never blank, never a generic catch-all shared across genuinely different
 * pages. Known static routes use the exact site-wide wording; /telehealth/
 * and /services/ dynamic paths get a targeted, still-distinguishing label;
 * anything else falls back to a humanized version of its own last path
 * segment, so a brand-new page always shows something recognizable rather
 * than disappearing or merging into an unrelated bucket.
 */
export function friendlyBookingPageLabel(path: string): string {
  const known = BOOKING_PATH_LABELS[path];
  if (known) return known;

  const telehealthMatch = path.match(/^\/telehealth\/([a-z-]+)$/);
  if (telehealthMatch) {
    const state = telehealthMatch[1] as string;
    return TELEHEALTH_STATE_LABELS[state] ?? `${humanizeSlug(state)} Telehealth`;
  }

  const serviceMatch = path.match(/^\/services\/([a-z0-9-]+)$/);
  if (serviceMatch) return humanizeSlug(serviceMatch[1] as string);

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 'Homepage';
  return humanizeSlug(segments[segments.length - 1] as string);
}

export const BOOKING_PATH_UNKNOWN_LABEL = 'Unknown / Unattributed';

export type BookingIntentByPageRow = { path: string | null; label: string; count: number };

/**
 * Aggregates already-fetched booking_click rows (their `path` field only —
 * see the /dashboard handler below, which fetches nothing else from this
 * table) into a friendly-labeled, descending-sorted breakdown. Pure and
 * directly unit-testable with synthetic input, no live Supabase connection
 * needed. A null/blank path is never dropped or silently folded into
 * Homepage — it becomes its own explicit BOOKING_PATH_UNKNOWN_LABEL bucket,
 * so SUM(returned counts) always equals rows.length exactly: the same
 * reconciliation guarantee this function's only caller relies on to match
 * the dashboard's own conversions7d total (both are derived from the exact
 * same query result, not two separate queries that could drift).
 */
export function aggregateBookingIntentByPage(rows: Array<{ path: string | null }>): BookingIntentByPageRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const trimmed = (row.path ?? '').trim();
    const key = trimmed || '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      path: key === '' ? null : key,
      label: key === '' ? BOOKING_PATH_UNKNOWN_LABEL : friendlyBookingPageLabel(key),
      count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      // Deterministic tie-break: ascending by path, with Unknown/
      // Unattributed (path: null) always sorting after every real path at
      // the same count — never by comparing null against a string, which
      // would place it first (empty-string-like) rather than last.
      if (a.path === null && b.path === null) return 0;
      if (a.path === null) return 1;
      if (b.path === null) return -1;
      return a.path.localeCompare(b.path);
    });
}

adminRouter.get(
  '/dashboard',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = getSupabase();
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [
      leads,
      services,
      testimonials,
      faqs,
      insurance,
      views,
      conversions,
      recentLeads,
    ] = await Promise.all([
      sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      sb.from('services').select('id', { count: 'exact', head: true }),
      sb.from('testimonials').select('id', { count: 'exact', head: true }).eq('published', true),
      sb.from('faqs').select('id', { count: 'exact', head: true }),
      sb.from('insurance_plans').select('id', { count: 'exact', head: true }),
      sb.from('analytics_events').select('id, created_at').eq('event_type', 'page_view').gte('created_at', since7),
      // Phase 8 P1-1: selects `path` (not just a head:true count) so the
      // booking-intent-by-page breakdown below is computed from this SAME
      // result set as conversions7d — guaranteeing exact reconciliation by
      // construction rather than by two queries happening to agree.
      // { count: 'exact' } without head:true still returns the exact count
      // alongside the row data (same pattern already used in
      // marketingCampaigns.controller.ts/marketingContacts.controller.ts).
      sb
        .from('conversions')
        .select('path', { count: 'exact' })
        .eq('conversion_type', 'booking_click')
        .gte('created_at', since7),
      sb.from('leads').select('id, type, name, email, status, created_at').order('created_at', { ascending: false }).limit(6),
    ]);

    const bookingIntentByPage = aggregateBookingIntentByPage(conversions.data ?? []);

    const byDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      byDay[d] = 0;
    }
    for (const row of views.data ?? []) {
      const day = String(row.created_at).slice(0, 10);
      if (day in byDay) byDay[day] = (byDay[day] ?? 0) + 1;
    }

    const actor = (req as AuthedRequest).admin;
    let recentLogs: unknown[] = [];
    if (actor?.role === 'super_admin') {
      const logs = await sb
        .from('admin_audit_logs')
        .select('id, actor_name, actor_email, action, summary, created_at')
        .order('created_at', { ascending: false })
        .limit(8);
      recentLogs = logs.data ?? [];
    }

    res.json({
      success: true,
      data: {
        newLeads: leads.count ?? 0,
        services: services.count ?? 0,
        testimonials: testimonials.count ?? 0,
        faqs: faqs.count ?? 0,
        insurance: insurance.count ?? 0,
        views7d: (views.data ?? []).length,
        conversions7d: conversions.count ?? 0,
        bookingIntentByPage,
        trend: Object.entries(byDay).map(([date, viewsCount]) => ({ date, views: viewsCount })),
        recentLeads: recentLeads.data ?? [],
        recentLogs,
      },
    });
  })
);

adminRouter.get('/leads', requireAdmin, requirePermission('leads'), asyncHandler(listLeads));
adminRouter.get('/leads/:id', requireAdmin, requirePermission('leads'), asyncHandler(getLead));
adminRouter.patch('/leads/:id', requireAdmin, requirePermission('leads'), asyncHandler(updateLead));
adminRouter.delete('/leads/:id', requireAdmin, requirePermission('leads'), asyncHandler(deleteLead));

adminRouter.get('/notifications', requireAdmin, asyncHandler(listNotifications));
adminRouter.patch('/notifications/read', requireAdmin, asyncHandler(markNotificationsRead));
adminRouter.get('/emails/config', requireAdmin, requireAnyPermission(['emails', 'leads']), asyncHandler(getMailConfig));
adminRouter.get('/emails', requireAdmin, requirePermission('emails'), asyncHandler(listEmails));
adminRouter.post('/emails/send', requireAdmin, requireAnyPermission(['emails', 'leads']), asyncHandler(sendAdminEmails));
adminRouter.get('/settings', requireAdmin, requirePermission('settings'), asyncHandler(getSiteSettings));
adminRouter.patch('/settings', requireAdmin, requirePermission('settings'), asyncHandler(updateSiteSettings));

adminRouter.use(
  '/announcements',
  createCrudRouter({
    table: 'announcements',
    module: 'announcements',
    createSchema: announcementCreate,
    updateSchema: announcementUpdate,
    orderBy: { column: 'sort_order', ascending: true },
  })
);

adminRouter.use(
  '/services',
  createCrudRouter({
    table: 'services',
    module: 'services',
    createSchema: serviceCreate,
    updateSchema: serviceUpdate,
    orderBy: { column: 'sort_order', ascending: true },
    // A null/'' category (legacy rows with none set yet, or the Admin form
    // resubmitting every field on an unrelated edit) must never overwrite
    // whatever the row already has — omit it rather than writing null, so
    // an uncategorized service never gets stuck re-clearing itself and can
    // still be explicitly assigned a real category later.
    beforeUpdate: (data) => {
      if (data.category === null) {
        const { category: _category, ...rest } = data;
        return rest;
      }
      return data;
    },
  })
);

adminRouter.use(
  '/providers',
  createCrudRouter({
    table: 'providers',
    module: 'providers',
    createSchema: providerCreate,
    updateSchema: providerUpdate,
    orderBy: { column: 'sort_order', ascending: true },
  })
);

/**
 * Phase 14 (Insurance Admin Governance Hardening): the exact failure modes
 * this guards against, all observed in Production without any of these
 * protections in place — a sync tool created duplicate payer rows because
 * nothing prevented a second row with a re-worded/differently-cased name;
 * an unrelated PATCH once carried a stray leading tab straight into
 * `logo_url` (Oxford) because nothing trimmed or validated it; and the
 * insurance_plans table has no server-side concept of "approved payer" at
 * all — any authenticated PATCH can flip `published: true` on any row
 * regardless of name, and `insuranceCreate`'s `published` defaults to
 * `true`, so a plain create publishes immediately unless told otherwise.
 *
 * APPROVED_INSURANCE_NAMES mirrors admin/src/app/(app)/insurance/page.tsx's
 * `approvedInsurance` exactly — there's no shared package between the
 * admin and server apps to import a single source from, so drift between
 * the two is only caught by
 * server/scripts/test-phase14-insurance-governance.mjs, which parses both
 * files' source and asserts they list the same names. Keep them in sync.
 */
const APPROVED_INSURANCE_NAMES = new Set([
  'AVMED Florida Exchange',
  'Florida Exchange',
  'Oscar Health Plan',
  'UBH General',
  'Veterans Affairs Coordinated Care Network Region 3',
  'Oxford (Commercial)',
  'Aetna (Commercial)',
  'First Health (Coventry Health Care)',
  'Cigna (Commercial)',
  'Medicaid',
  'Medicare',
  'UHC Medicare Advantage',
  'Optum',
  'Curative',
  'TRICARE',
]);

export function normalizeInsuranceName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function assertUniqueInsuranceName(name: string, excludeId?: string): Promise<void> {
  const normalized = normalizeInsuranceName(name);
  const { data, error } = await getSupabase().from('insurance_plans').select('id, name');
  if (error) throw badRequest(error.message);
  const collision = (data ?? []).find(
    (row) => row.id !== excludeId && normalizeInsuranceName(String(row.name ?? '')) === normalized
  );
  if (collision) {
    // Owner-friendly, no row id/SQL/internals exposed.
    throw new AppError('An insurance payer with this name already exists.', 409, { expose: true });
  }
}

/**
 * Only blocks the transition that actually matters — a payer ending up
 * *published* with a name outside the approved set. A historical
 * unapproved row may still exist unpublished (never auto-deleted; see
 * P4-G1B's Curative row precedent), and editing an unrelated field on it
 * doesn't touch this check at all, since it only runs when `name` or
 * `published` is actually present in the request payload.
 */
async function assertApprovedForPublication(name: string, published: boolean): Promise<void> {
  if (!published) return;
  if (!APPROVED_INSURANCE_NAMES.has(name)) {
    throw new AppError(
      `"${name}" is not on LifeWell's approved insurance payer list and cannot be published. It can still be saved unpublished.`,
      400,
      { expose: true }
    );
  }
}

const SAFE_LOCAL_LOGO_PREFIX = '/images/insurance/';
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/;
const UNSAFE_SCHEME_RE = /^(javascript|data|vbscript|file):/i;

/**
 * Trims incidental whitespace (the Oxford incident: a bare leading tab,
 * otherwise a valid path) and rejects anything actually unsafe. Never
 * rewrites a bad value into a different-but-valid one — an invalid input
 * fails closed with an owner-facing message, it doesn't get guessed at.
 */
export function normalizeAndValidateLogoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;
  if (CONTROL_CHAR_RE.test(trimmed)) {
    throw badRequest('Logo URL contains invalid control characters.');
  }
  if (UNSAFE_SCHEME_RE.test(trimmed)) {
    throw badRequest('Logo URL uses an unsafe scheme and cannot be saved.');
  }
  if (trimmed.startsWith('/')) {
    const lower = trimmed.toLowerCase();
    if (!trimmed.startsWith(SAFE_LOCAL_LOGO_PREFIX) || trimmed.includes('..') || trimmed.includes('\\') || lower.includes('%2e')) {
      throw badRequest(`Local logo paths must start with "${SAFE_LOCAL_LOGO_PREFIX}" and cannot contain traversal segments.`);
    }
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw badRequest('Logo URL is not a valid URL.');
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
      throw badRequest('Logo URL must be a valid http or https URL.');
    }
    return trimmed;
  }
  throw badRequest(`Logo URL must be a local "${SAFE_LOCAL_LOGO_PREFIX}" path or a valid http(s) URL.`);
}

function normalizeInsuranceLogoUrl(data: Record<string, unknown>): Record<string, unknown> {
  if (typeof data.logo_url === 'string') {
    return { ...data, logo_url: normalizeAndValidateLogoUrl(data.logo_url) };
  }
  return data;
}

async function assertInsurancePublicationAllowed(
  data: Record<string, unknown>,
  id?: string
): Promise<void> {
  const nameProvided = typeof data.name === 'string';
  const publishedProvided = typeof data.published === 'boolean';
  if (!nameProvided && !publishedProvided) return;
  let effectiveName = nameProvided ? (data.name as string) : undefined;
  let effectivePublished = publishedProvided ? (data.published as boolean) : undefined;
  if (id && (effectiveName === undefined || effectivePublished === undefined)) {
    const { data: existing } = await getSupabase()
      .from('insurance_plans')
      .select('name, published')
      .eq('id', id)
      .maybeSingle();
    if (effectiveName === undefined) effectiveName = existing?.name;
    if (effectivePublished === undefined) effectivePublished = existing?.published ?? false;
  }
  if (effectiveName !== undefined && effectivePublished !== undefined) {
    await assertApprovedForPublication(effectiveName, effectivePublished);
  }
}

adminRouter.use(
  '/insurance',
  createCrudRouter({
    table: 'insurance_plans',
    module: 'insurance',
    createSchema: insuranceCreate,
    updateSchema: insuranceUpdate,
    orderBy: { column: 'sort_order', ascending: true },
    beforeCreate: normalizeInsuranceLogoUrl,
    beforeUpdate: normalizeInsuranceLogoUrl,
    // Each check only runs when the field it cares about is actually part
    // of this request's payload, so an edit to notes/sort_order/logo_url
    // alone never gets blocked by name-uniqueness or approved-payer rules.
    validateCreate: async (data) => {
      if (typeof data.name === 'string') await assertUniqueInsuranceName(data.name);
      await assertInsurancePublicationAllowed(data);
    },
    validateUpdate: async (data, id) => {
      if (typeof data.name === 'string') await assertUniqueInsuranceName(data.name, id);
      await assertInsurancePublicationAllowed(data, id);
    },
  })
);

adminRouter.use(
  '/testimonials',
  createCrudRouter({
    table: 'testimonials',
    module: 'testimonials',
    createSchema: testimonialCreate,
    updateSchema: testimonialUpdate,
    orderBy: { column: 'sort_order', ascending: true },
  })
);

/**
 * Phase 11 (FAQ Admin Governance Hardening): the exact incident this
 * guards against — the same "Do you offer a sliding scale option?"
 * question was created twice in Production, once with slightly different
 * wording, because nothing stopped it. Normalization is deliberately
 * conservative (trim + collapse internal whitespace + lowercase) — no
 * fuzzy/semantic matching, so "How much will my copay be?" and "What
 * determines my copay?" are correctly treated as different questions.
 * Global across categories, not scoped to one: the incident's duplicate
 * was the exact same category, but a duplicate question sitting in two
 * different categories would be exactly as confusing for an owner
 * managing this list, and a Production inventory check before this
 * change found zero legitimate cross-category (or same-category) exact
 * duplicates — so nothing legitimate is broken by enforcing this
 * globally.
 */
export function normalizeFaqQuestion(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function assertUniqueFaqQuestion(question: string, excludeId?: string): Promise<void> {
  const normalized = normalizeFaqQuestion(question);
  const { data, error } = await getSupabase().from('faqs').select('id, question');
  if (error) throw badRequest(error.message);
  const collision = (data ?? []).find(
    (row) => row.id !== excludeId && normalizeFaqQuestion(String(row.question ?? '')) === normalized
  );
  if (collision) {
    // Owner-friendly, no row id/SQL/internals exposed.
    throw new AppError('An FAQ with this question already exists.', 409, { expose: true });
  }
}

adminRouter.use(
  '/faqs',
  createCrudRouter({
    table: 'faqs',
    module: 'faqs',
    createSchema: faqCreate,
    updateSchema: faqUpdate,
    orderBy: { column: 'sort_order', ascending: true },
    // Only runs the check when `question` is actually part of this
    // request's payload — a category-only PATCH never touches it, so it
    // can never accidentally block an otherwise-unrelated edit.
    validateCreate: async (data) => {
      if (typeof data.question === 'string') await assertUniqueFaqQuestion(data.question);
    },
    validateUpdate: async (data, id) => {
      if (typeof data.question === 'string') await assertUniqueFaqQuestion(data.question, id);
    },
  })
);

/**
 * Phase 12 (Admin Content Governance Audit): "primary location" is used by
 * 4 separate public-client lookups (Footer, SiteHeader, /bio, /contact —
 * each does `.find((row) => row.isPrimary) ?? cms.locations[0]`) as if it
 * were guaranteed unique, but nothing before this change actually enforced
 * that — the public `locations` query has no ORDER BY either, so if two
 * rows both had `is_primary: true`, which one every one of those 4 lookups
 * treats as "the" primary location would depend on unspecified Postgres/
 * PostgREST row order. Only 1 location currently exists in Production, so
 * this was latent, not yet manifesting — but the field's own semantics
 * ("the" primary location, singular) make this squarely the kind of
 * identity that's supposed to be unique.
 */
async function assertAtMostOnePrimaryLocation(isPrimary: unknown, excludeId?: string): Promise<void> {
  if (isPrimary !== true) return;
  const { data, error } = await getSupabase().from('locations').select('id, is_primary');
  if (error) throw badRequest(error.message);
  const collision = (data ?? []).find((row) => row.id !== excludeId && row.is_primary === true);
  if (collision) {
    throw new AppError(
      'Another location is already set as primary. Unset it first, then mark this one as primary.',
      409,
      { expose: true }
    );
  }
}

adminRouter.use(
  '/locations',
  createCrudRouter({
    table: 'locations',
    module: 'locations',
    createSchema: locationCreate,
    updateSchema: locationUpdate,
    orderBy: { column: 'created_at', ascending: false },
    validateCreate: async (data) => {
      await assertAtMostOnePrimaryLocation(data.is_primary);
    },
    validateUpdate: async (data, id) => {
      await assertAtMostOnePrimaryLocation(data.is_primary, id);
    },
  })
);

adminRouter.use(
  '/telehealth-states',
  createCrudRouter({
    table: 'telehealth_state_pages',
    module: 'telehealth_states',
    createSchema: telehealthStateCreate,
    updateSchema: telehealthStateUpdate,
    orderBy: { column: 'sort_order', ascending: true },
  })
);

/**
 * Phase 12: `related_service_slug` is free text server-side (see
 * blogCreate's comment in adminSchemas.ts) but the Admin blog editor only
 * ever offers a fixed dropdown of known service slugs — validating against
 * the live `services` table at request time (rather than a hardcoded
 * server-side list) means this can never drift from whatever services
 * actually exist right now, without duplicating the Admin's own list
 * server-side. An empty/blank value ('no related service') is always
 * allowed and skips the check entirely.
 */
async function assertValidRelatedServiceSlug(slug: unknown): Promise<void> {
  if (typeof slug !== 'string' || !slug.trim()) return;
  const { data, error } = await getSupabase().from('services').select('id').eq('slug', slug).maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) {
    throw new AppError('That related service no longer exists. Choose a current service.', 409, { expose: true });
  }
}

adminRouter.use(
  '/blog',
  createCrudRouter({
    table: 'blog_posts',
    module: 'blog',
    createSchema: blogCreate,
    updateSchema: blogUpdate,
    orderBy: { column: 'updated_at', ascending: false },
    beforeCreate: (data) => ({
      ...data,
      published_at: data.published ? data.published_at || new Date().toISOString() : data.published_at ?? null,
    }),
    beforeUpdate: (data) => ({
      ...data,
      published_at:
        data.published === true && !data.published_at ? new Date().toISOString() : data.published_at,
    }),
    validateCreate: async (data) => {
      await assertValidRelatedServiceSlug(data.related_service_slug);
    },
    validateUpdate: async (data) => {
      await assertValidRelatedServiceSlug(data.related_service_slug);
    },
  })
);

adminRouter.post(
  '/media/upload',
  requireAdmin,
  requirePermission('media'),
  asyncHandler(handleMediaUpload)
);

adminRouter.use(
  '/media',
  createCrudRouter({
    table: 'media_assets',
    module: 'media',
    createSchema: mediaCreate,
    updateSchema: mediaUpdate,
    orderBy: { column: 'created_at', ascending: false },
  })
);

adminRouter.use(
  '/videos',
  createCrudRouter({
    table: 'videos',
    module: 'videos',
    createSchema: videoCreate,
    updateSchema: videoUpdate,
    orderBy: { column: 'sort_order', ascending: true },
  })
);

adminRouter.use(
  '/sections',
  createCrudRouter({
    table: 'site_sections',
    module: 'sections',
    createSchema: sectionCreate,
    updateSchema: sectionUpdate,
    orderBy: { column: 'page_key', ascending: true },
    beforeCreate: enforceStatsVerificationGate,
    beforeUpdate: enforceStatsVerificationGate,
  })
);

adminRouter.use(
  '/booking',
  createCrudRouter({
    table: 'booking_settings',
    module: 'booking',
    createSchema: bookingCreate,
    updateSchema: bookingUpdate,
    orderBy: { column: 'updated_at', ascending: false },
  })
);

adminRouter.use(
  '/seo',
  createCrudRouter({
    table: 'seo_meta',
    module: 'seo',
    createSchema: seoCreate,
    updateSchema: seoUpdate,
    orderBy: { column: 'path', ascending: true },
  })
);

adminRouter.get(
  '/analytics/summary',
  requireAdmin,
  requirePermission('analytics'),
  asyncHandler(getAnalyticsSummary)
);

/**
 * Marketing contact directory (P4-I2C). Deliberately NOT createCrudRouter —
 * this table needs server-side pagination/search/filtering (the generic
 * factory fetches every row unbounded) and effective-row status-transition
 * validation (the generic factory has no concept of it). No DELETE route:
 * marketing suppression/unsubscribe history is intentionally preserved,
 * not erasable — see the P4-I2C design notes.
 */
adminRouter.get(
  '/marketing-contacts',
  requireAdmin,
  requirePermission('marketing_contacts'),
  asyncHandler(listMarketingContacts)
);
adminRouter.get(
  '/marketing-contacts/:id',
  requireAdmin,
  requirePermission('marketing_contacts'),
  asyncHandler(getMarketingContact)
);
adminRouter.post(
  '/marketing-contacts',
  requireAdmin,
  requirePermission('marketing_contacts'),
  asyncHandler(createMarketingContact)
);
adminRouter.patch(
  '/marketing-contacts/:id',
  requireAdmin,
  requirePermission('marketing_contacts'),
  asyncHandler(updateMarketingContact)
);

/**
 * Explicit resubscription (P4-I3). The ONLY Admin path allowed to perform
 * unsubscribed -> subscribed — generic PATCH above continues to reject it.
 * Same permission gate as every other marketing-contacts route; no
 * separate "campaigns" permission, no public access.
 */
adminRouter.post(
  '/marketing-contacts/:id/resubscribe',
  requireAdmin,
  requirePermission('marketing_contacts'),
  asyncHandler(resubscribeMarketingContact)
);

/**
 * CSV import (P4-I2E). Two-stage: preview parses/validates/classifies with
 * zero database writes and returns a signed, short-lived preview token;
 * confirm re-validates that token and inserts only rows still classified
 * new. Same permission gate as the rest of the directory. No DELETE
 * endpoint here either — import can only ever add new contacts.
 */
adminRouter.post(
  '/marketing-contacts/import/preview',
  requireAdmin,
  requirePermission('marketing_contacts'),
  asyncHandler(previewMarketingContactsImport)
);
adminRouter.post(
  '/marketing-contacts/import/confirm',
  requireAdmin,
  requirePermission('marketing_contacts'),
  asyncHandler(confirmMarketingContactsImport)
);

/**
 * Marketing campaign DRAFTS (P4-I4B). Gated by its own dedicated
 * marketing_campaigns permission — deliberately NOT marketing_contacts,
 * since managing the contact directory and managing campaign drafts are
 * different responsibilities. DELETE, duplicate, and manual/test send all
 * share this same permission — see below for each route's own scope notes.
 */
adminRouter.get(
  '/marketing-campaigns',
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(listMarketingCampaigns)
);
adminRouter.get(
  '/marketing-campaigns/:id',
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(getMarketingCampaign)
);
adminRouter.post(
  '/marketing-campaigns',
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(createMarketingCampaign)
);
adminRouter.patch(
  '/marketing-campaigns/:id',
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(updateMarketingCampaign)
);
adminRouter.post(
  '/marketing-campaigns/:id/archive',
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(archiveMarketingCampaign)
);
adminRouter.get(
  '/marketing-campaigns/:id/recipient-preview',
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(previewMarketingCampaignRecipients)
);
/**
 * Manual campaign delivery (P4-I5B). Same permission as the rest of this
 * resource — no separate delivery permission was introduced. POST only;
 * no GET path can ever trigger a send. No scheduling, no queue, no
 * automatic retry — see marketingCampaignDelivery.service.ts.
 */
adminRouter.post(
  '/marketing-campaigns/:id/send',
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(sendMarketingCampaign)
);
/**
 * Send ONE test email of a saved draft's real content to a caller-supplied
 * address (campaign management + safe test send). A dedicated rate limiter
 * sits in front of the auth/permission checks — see
 * marketingCampaignTestSendLimiter in middleware/index.ts — since this
 * still fires one real outbound Paubox call per request. Never creates
 * marketing_campaign_recipients rows, never delivery-locks the campaign,
 * never touches marketing_contacts.
 */
adminRouter.post(
  '/marketing-campaigns/:id/test-send',
  marketingCampaignTestSendLimiter,
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(sendTestMarketingCampaign)
);
/**
 * Delete a campaign draft (campaign management + safe test send). Blocked
 * with a 409 for any campaign with delivery already initiated — see
 * deleteMarketingCampaign()'s own isCampaignDeliveryLocked() check, backed
 * by the marketing_campaign_recipients FK having no ON DELETE CASCADE.
 */
adminRouter.delete(
  '/marketing-campaigns/:id',
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(deleteMarketingCampaign)
);
/**
 * Duplicate a campaign (locked, archived, or draft) as a brand-new draft —
 * the only way to reuse a locked/archived campaign's content, since the
 * original stays permanently un-editable and un-resendable.
 */
adminRouter.post(
  '/marketing-campaigns/:id/duplicate',
  requireAdmin,
  requirePermission('marketing_campaigns'),
  asyncHandler(duplicateMarketingCampaign)
);

adminRouter.get('/users', requireAdmin, requireSuperAdmin, asyncHandler(listAdminUsers));
adminRouter.post('/users', requireAdmin, requireSuperAdmin, asyncHandler(createAdminUser));
adminRouter.patch('/users/:id', requireAdmin, requireSuperAdmin, asyncHandler(updateAdminUser));
adminRouter.delete('/users/:id', requireAdmin, requireSuperAdmin, asyncHandler(deleteAdminUser));
adminRouter.post('/users/:id/invite', requireAdmin, requireSuperAdmin, asyncHandler(sendStaffCredentials));
adminRouter.post('/content/import-live', requireAdmin, requireSuperAdmin, asyncHandler(importLiveWebsiteContent));
adminRouter.get('/audit-logs', requireAdmin, requireSuperAdmin, asyncHandler(listAuditLogs));

// Health of admin stack
adminRouter.get(
  '/health',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    try {
      const { error } = await getSupabase().from('admin_users').select('id', { count: 'exact', head: true });
      if (error) throw badRequest(error.message);
      res.json({ success: true, database: 'ok' });
    } catch (err) {
      res.status(503).json({
        success: false,
        database: 'error',
        message: err instanceof Error ? err.message : 'Database unavailable',
      });
    }
  })
);
