import type { Request, Response } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';
import {
  analyticsIngestSchema,
  conversionIngestSchema,
} from '../validation/adminSchemas.js';

export async function handleAnalyticsIngest(req: Request, res: Response): Promise<void> {
  const parsed = analyticsIngestSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid analytics payload.');

  // Never accept free-text or identifiers — schema already strips them.
  const { error } = await getSupabase().from('analytics_events').insert(parsed.data);
  if (error) throw badRequest(error.message);
  res.status(201).json({ success: true });
}

export async function handleConversionIngest(req: Request, res: Response): Promise<void> {
  const parsed = conversionIngestSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid conversion payload.');

  // Strip any accidental PII keys from meta.
  const meta = { ...parsed.data.meta };
  for (const key of Object.keys(meta)) {
    if (/email|phone|name|message|dob|ssn|mrn/i.test(key)) delete meta[key];
  }

  const { error } = await getSupabase().from('conversions').insert({
    conversion_type: parsed.data.conversion_type,
    path: parsed.data.path ?? null,
    meta,
  });
  if (error) throw badRequest(error.message);
  res.status(201).json({ success: true });
}

export async function getAnalyticsSummary(_req: Request, res: Response): Promise<void> {
  const sb = getSupabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [eventsRes, conversionsRes] = await Promise.all([
    sb.from('analytics_events').select('event_type, path, referrer_host, device, created_at').gte('created_at', since),
    sb.from('conversions').select('conversion_type, path, created_at').gte('created_at', since),
  ]);

  if (eventsRes.error) throw badRequest(eventsRes.error.message);
  if (conversionsRes.error) throw badRequest(conversionsRes.error.message);

  const events = eventsRes.data ?? [];
  const conversions = conversionsRes.data ?? [];

  const pageViews = events.filter((e) => e.event_type === 'page_view');
  const byPath: Record<string, number> = {};
  const byDevice: Record<string, number> = {};
  const byReferrer: Record<string, number> = {};
  const byDay: Record<string, number> = {};

  for (const e of pageViews) {
    const path = e.path || '/';
    byPath[path] = (byPath[path] ?? 0) + 1;
    const device = e.device || 'unknown';
    byDevice[device] = (byDevice[device] ?? 0) + 1;
    const ref = e.referrer_host || 'direct';
    byReferrer[ref] = (byReferrer[ref] ?? 0) + 1;
    const day = (e.created_at as string).slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  const popularPages = Object.entries(byPath)
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);

  const trafficSources = Object.entries(byReferrer)
    .map(([source, visits]) => ({ source, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 15);

  const trends = Object.entries(byDay)
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const conversionCounts = conversions.reduce<Record<string, number>>((acc, c) => {
    acc[c.conversion_type] = (acc[c.conversion_type] ?? 0) + 1;
    return acc;
  }, {});

  const byBookingClickPath: Record<string, number> = {};
  for (const c of conversions) {
    if (c.conversion_type !== 'booking_click') continue;
    const path = c.path || '/';
    byBookingClickPath[path] = (byBookingClickPath[path] ?? 0) + 1;
  }
  const topBookingPages = Object.entries(byBookingClickPath)
    .map(([path, clicks]) => ({ path, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 15);

  const priorSince = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const midpoint = since;
  const [priorEvents, priorConversions] = await Promise.all([
    sb.from('analytics_events').select('event_type, created_at').gte('created_at', priorSince).lt('created_at', midpoint),
    sb.from('conversions').select('id, created_at').gte('created_at', priorSince).lt('created_at', midpoint),
  ]);
  const priorViews = (priorEvents.data ?? []).filter((e) => e.event_type === 'page_view').length;
  const priorSessions = (priorEvents.data ?? []).filter((e) => e.event_type === 'session_start').length;
  const priorConv = (priorConversions.data ?? []).length;

  const pct = (now: number, prev: number) => {
    if (!prev) return now ? 100 : 0;
    return Math.round(((now - prev) / prev) * 100);
  };

  res.json({
    success: true,
    data: {
      rangeDays: 30,
      totals: {
        pageViews: pageViews.length,
        sessions: events.filter((e) => e.event_type === 'session_start').length,
        conversions: conversions.length,
      },
      deltas: {
        pageViews: pct(pageViews.length, priorViews),
        sessions: pct(events.filter((e) => e.event_type === 'session_start').length, priorSessions),
        conversions: pct(conversions.length, priorConv),
      },
      popularPages,
      devices: byDevice,
      trafficSources,
      trends,
      conversionCounts,
      topBookingPages,
    },
  });
}
