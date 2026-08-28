import type { Request, Response } from 'express';
import { getSupabase, supabaseConfigured } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Public read APIs for the marketing site.
 * Only published / active content is returned.
 */

type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Resolves one table's query independently. A schema mismatch or other
 * per-table failure (for example, a migration that hasn't been applied to
 * this environment yet) degrades to an empty result for that section only —
 * it must never take down the entire public content payload the way a
 * shared Promise.all + single thrown error previously did. When every
 * section fails, callers still see it via cmsLive() falling back to static
 * defaults; a single broken section should not force the same fallback for
 * content that loaded fine.
 */
async function resolveTable<T>(label: string, query: PromiseLike<QueryResult<T>>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    logger.error(`public content: ${label} query failed`, { message: error.message });
    return [];
  }
  return data ?? [];
}

export async function getPublicContent(_req: Request, res: Response): Promise<void> {
  if (!supabaseConfigured()) {
    res.json({ success: true, data: null, source: 'unconfigured' });
    return;
  }

  const sb = getSupabase();
  const [
    announcements,
    services,
    providers,
    insurance,
    testimonials,
    faqs,
    locations,
    telehealthStates,
    posts,
    videos,
    sections,
    booking,
    seo,
    settingsResult,
  ] = await Promise.all([
    resolveTable('announcements', sb.from('announcements').select('*').eq('active', true).order('sort_order')),
    resolveTable('services', sb.from('services').select('*').eq('published', true).order('sort_order')),
    resolveTable('providers', sb.from('providers').select('*').eq('published', true).order('sort_order')),
    resolveTable('insurance_plans', sb.from('insurance_plans').select('*').eq('published', true).order('sort_order')),
    resolveTable('testimonials', sb.from('testimonials').select('*').eq('published', true).order('sort_order')),
    resolveTable('faqs', sb.from('faqs').select('*').eq('published', true).order('sort_order')),
    resolveTable('locations', sb.from('locations').select('*').eq('published', true)),
    resolveTable(
      'telehealth_state_pages',
      sb.from('telehealth_state_pages').select('*').eq('published', true).order('sort_order')
    ),
    resolveTable(
      'blog_posts',
      sb
        .from('blog_posts')
        .select('id, slug, title, excerpt, cover_image_url, author_name, published_at, seo_title, seo_description')
        .eq('published', true)
        .order('published_at', { ascending: false })
    ),
    resolveTable('videos', sb.from('videos').select('*').eq('published', true).order('sort_order')),
    resolveTable('site_sections', sb.from('site_sections').select('*').eq('published', true).order('updated_at', { ascending: false })),
    resolveTable('booking_settings', sb.from('booking_settings').select('*').eq('active', true)),
    resolveTable('seo_meta', sb.from('seo_meta').select('*')),
    (async () => {
      const { data, error } = await sb.from('site_settings').select('*').eq('id', 'default');
      if (error) {
        logger.error('public content: site_settings query failed', { message: error.message });
        return null;
      }
      return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
    })(),
  ]);

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    source: 'cms',
    data: {
      announcements,
      services,
      providers,
      insurance,
      testimonials,
      faqs,
      locations,
      telehealthStates,
      posts,
      videos,
      sections,
      booking,
      seo,
      settings: settingsResult,
    },
  });
}

export async function getPublicBlogPost(req: Request, res: Response): Promise<void> {
  const { data, error } = await getSupabase()
    .from('blog_posts')
    .select('*')
    .eq('slug', req.params.slug)
    .eq('published', true)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data });
}
