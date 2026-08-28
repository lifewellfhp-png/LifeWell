import type { Request, Response } from 'express';
import { getSupabase, supabaseConfigured } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';

/**
 * Public read APIs for the marketing site.
 * Only published / active content is returned.
 */
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
    posts,
    videos,
    sections,
    booking,
    seo,
    settings,
  ] = await Promise.all([
    sb.from('announcements').select('*').eq('active', true).order('sort_order'),
    sb.from('services').select('*').eq('published', true).order('sort_order'),
    sb.from('providers').select('*').eq('published', true).order('sort_order'),
    sb.from('insurance_plans').select('*').eq('published', true).order('sort_order'),
    sb.from('testimonials').select('*').eq('published', true).order('sort_order'),
    sb.from('faqs').select('*').eq('published', true).order('sort_order'),
    sb.from('locations').select('*').eq('published', true),
    sb.from('blog_posts').select('id, slug, title, excerpt, cover_image_url, author_name, category, published_at, seo_title, seo_description').eq('published', true).order('published_at', { ascending: false }),
    sb.from('videos').select('*').eq('published', true).order('sort_order'),
    sb.from('site_sections').select('*').eq('published', true).order('updated_at', { ascending: false }),
    sb.from('booking_settings').select('*').eq('active', true),
    sb.from('seo_meta').select('*'),
    sb.from('site_settings').select('*').eq('id', 'default'),
  ]);

  const firstError = [
    announcements, services, providers, insurance, testimonials, faqs,
    locations, posts, videos, sections, booking, seo,
  ].find((r) => r.error)?.error;

  if (firstError) throw badRequest(firstError.message);

  const settingsRow = settings.error
    ? null
    : Array.isArray(settings.data)
      ? settings.data[0] ?? null
      : settings.data ?? null;

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    source: 'cms',
    data: {
      announcements: announcements.data ?? [],
      services: services.data ?? [],
      providers: providers.data ?? [],
      insurance: insurance.data ?? [],
      testimonials: testimonials.data ?? [],
      faqs: faqs.data ?? [],
      locations: locations.data ?? [],
      posts: posts.data ?? [],
      videos: videos.data ?? [],
      sections: sections.data ?? [],
      booking: booking.data ?? [],
      seo: seo.data ?? [],
      settings: settingsRow,
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
