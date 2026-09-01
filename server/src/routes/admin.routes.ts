import { Router } from 'express';
import { asyncHandler, adminLoginLimiter, changePasswordLimiter } from '../middleware/index.js';
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
} from '../controllers/marketingCampaigns.controller.js';
import { sendMarketingCampaign } from '../services/marketingCampaignDelivery.service.js';
import { getSupabase } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';

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
      sb.from('conversions').select('id', { count: 'exact', head: true }).gte('created_at', since7),
      sb.from('leads').select('id, type, name, email, status, created_at').order('created_at', { ascending: false }).limit(6),
    ]);

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

adminRouter.use(
  '/insurance',
  createCrudRouter({
    table: 'insurance_plans',
    module: 'insurance',
    createSchema: insuranceCreate,
    updateSchema: insuranceUpdate,
    orderBy: { column: 'sort_order', ascending: true },
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

adminRouter.use(
  '/faqs',
  createCrudRouter({
    table: 'faqs',
    module: 'faqs',
    createSchema: faqCreate,
    updateSchema: faqUpdate,
    orderBy: { column: 'sort_order', ascending: true },
  })
);

adminRouter.use(
  '/locations',
  createCrudRouter({
    table: 'locations',
    module: 'locations',
    createSchema: locationCreate,
    updateSchema: locationUpdate,
    orderBy: { column: 'created_at', ascending: false },
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
 * different responsibilities. No DELETE route (no delete exists in this
 * phase) and no send/schedule route (delivery does not exist yet — P4-I5).
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
