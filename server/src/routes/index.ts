import { Router } from 'express';
import { handleContact } from '../controllers/contact.controller.js';
import { handleNewsletter } from '../controllers/newsletter.controller.js';
import {
  getPublicContent,
  getPublicBlogPost,
} from '../controllers/publicContent.controller.js';
import {
  handleAnalyticsIngest,
  handleConversionIngest,
} from '../controllers/analytics.controller.js';
import { handleMarketingUnsubscribe } from '../controllers/marketingUnsubscribe.controller.js';
import {
  asyncHandler,
  contactLimiter,
  newsletterLimiter,
  analyticsLimiter,
  conversionLimiter,
  marketingUnsubscribeLimiter,
} from '../middleware/index.js';
import { mailConfigured, env } from '../config/env.js';
import { adminRouter } from './admin.routes.js';
import { supabaseConfigured } from '../lib/supabase.js';

export const router: Router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'LifeWell API',
  });
});

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    integrations: {
      mail: mailConfigured ? 'configured' : 'log-only',
      newsletter: env.NEWSLETTER_PROVIDER,
      supabase: supabaseConfigured() ? 'configured' : 'missing',
    },
  });
});

router.post('/api/contact', contactLimiter, asyncHandler(handleContact));
router.post('/api/newsletter', newsletterLimiter, asyncHandler(handleNewsletter));

// Public CMS + privacy-focused telemetry for the marketing site
router.get('/api/public/content', asyncHandler(getPublicContent));
router.get('/api/public/blog/:slug', asyncHandler(getPublicBlogPost));
router.post('/api/public/analytics', analyticsLimiter, asyncHandler(handleAnalyticsIngest));
router.post('/api/public/conversions', conversionLimiter, asyncHandler(handleConversionIngest));

// Public marketing unsubscribe (P4-I3). Authorized by an opaque signed
// token only — no Admin auth, no raw email address accepted.
router.post('/api/marketing/unsubscribe', marketingUnsubscribeLimiter, asyncHandler(handleMarketingUnsubscribe));

// Admin CMS API
router.use('/api/admin', adminRouter);
