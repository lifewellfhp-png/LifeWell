-- Migration: analytics_summary() RPC function
-- Date: 2026-10-19
-- Author: analytics accuracy fix (Admin Analytics showing suspiciously
--   round numbers: page views = 1000, devices/sources summing to ~1000,
--   "+0% vs prior 30 days")
--
-- BACKGROUND
-- server/src/controllers/analytics.controller.ts's getAnalyticsSummary()
-- fetches every analytics_events/conversions row in the selected date
-- range via a plain .select(), then counts/groups them in JavaScript.
-- Supabase's PostgREST layer caps any plain .select() at 1000 rows by
-- default. Once a 30-day window has more than 1000 events, every count in
-- that function silently truncates at exactly 1000 — including the PRIOR
-- 30-day comparison query, which hits the same cap, so the delta often
-- reads "+0%" (same capped number both periods, not actually flat).
--
-- This migration adds a Postgres function that does all counting/grouping
-- in SQL (count(*), group by, limit) and returns one JSONB object. An
-- aggregate result has no row-count cap — only a raw table scan does.
--
-- server/src/controllers/analytics.controller.ts's getAnalyticsSummary is
-- updated in the same change to call this function via supabase.rpc(...)
-- instead of its own two .select() + JS-loop aggregation. No application
-- code change is required beyond that one function body — the final JSON
-- response shape to the Admin UI is unchanged.
--
-- SAFETY
-- - Purely additive: CREATE FUNCTION, no table/column change, no data
--   migration, nothing to backfill.
-- - Read-only: the function only ever SELECTs from analytics_events and
--   conversions, never writes.
-- - Date-boundary math mirrors the application code's own
--   zonedMidnightToUtc()/prior-period logic exactly (half-open interval,
--   zoned-midnight boundaries, prior period = immediately preceding window
--   of the same length) — see STEP 3 below for a way to cross-check this
--   against the (now capped) JS implementation on a known-small range
--   before the application code switches over to this function.
-- - EXECUTE is revoked from PUBLIC/anon/authenticated and granted only to
--   service_role, matching this schema's already-safety-conscious
--   default-deny posture (the API's Supabase client already connects with
--   the service-role key and so already bypasses RLS entirely — this is
--   defense-in-depth, not a functional requirement for the existing
--   access pattern).

-- =============================================================================
-- STEP 1 — read-only: sanity-check today's (capped) numbers before changing
-- anything, so you have a baseline to compare the new function's output
-- against once it's installed. Replace the dates with a real recent range.
-- =============================================================================
-- select count(*) as total_page_views_uncapped
-- from analytics_events
-- where event_type = 'page_view'
--   and created_at >= '2026-09-19T04:00:00Z'
--   and created_at <  '2026-10-19T04:00:00Z';
--
-- select count(*) as total_conversions_uncapped
-- from conversions
-- where created_at >= '2026-09-19T04:00:00Z'
--   and created_at <  '2026-10-19T04:00:00Z';

-- =============================================================================
-- STEP 2 — the migration itself (idempotent; safe to run more than once)
-- =============================================================================
create or replace function analytics_summary(
  p_from date,
  p_to date,
  p_tz text default 'America/New_York'
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_range_start timestamptz;
  v_range_end timestamptz;
  v_prior_start timestamptz;
  v_prior_end timestamptz;
  v_range_days int;
  v_result jsonb;
begin
  v_range_days := (p_to - p_from) + 1;
  v_range_start := (p_from::timestamp) at time zone p_tz;
  v_range_end := ((p_to + 1)::timestamp) at time zone p_tz;
  v_prior_end := v_range_start;
  v_prior_start := ((p_from - v_range_days)::timestamp) at time zone p_tz;

  select jsonb_build_object(
    'pageViews', (
      select count(*) from analytics_events
      where event_type = 'page_view'
        and created_at >= v_range_start and created_at < v_range_end
    ),
    'conversions', (
      select count(*) from conversions
      where created_at >= v_range_start and created_at < v_range_end
    ),
    'priorPageViews', (
      select count(*) from analytics_events
      where event_type = 'page_view'
        and created_at >= v_prior_start and created_at < v_prior_end
    ),
    'priorConversions', (
      select count(*) from conversions
      where created_at >= v_prior_start and created_at < v_prior_end
    ),
    'byDevice', (
      select coalesce(jsonb_object_agg(coalesce(device, 'unknown'), cnt), '{}'::jsonb)
      from (
        select device, count(*) as cnt
        from analytics_events
        where event_type = 'page_view'
          and created_at >= v_range_start and created_at < v_range_end
        group by device
      ) d
    ),
    'popularPages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', p, 'views', cnt)), '[]'::jsonb)
      from (
        select coalesce(path, '/') as p, count(*) as cnt
        from analytics_events
        where event_type = 'page_view'
          and created_at >= v_range_start and created_at < v_range_end
        group by coalesce(path, '/')
        order by count(*) desc
        limit 15
      ) t
    ),
    'trafficSources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', r, 'visits', cnt)), '[]'::jsonb)
      from (
        select coalesce(referrer_host, 'direct') as r, count(*) as cnt
        from analytics_events
        where event_type = 'page_view'
          and created_at >= v_range_start and created_at < v_range_end
        group by coalesce(referrer_host, 'direct')
        order by count(*) desc
        limit 15
      ) t
    ),
    'trends', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day, 'views', cnt) order by day), '[]'::jsonb)
      from (
        select (created_at at time zone p_tz)::date::text as day, count(*) as cnt
        from analytics_events
        where event_type = 'page_view'
          and created_at >= v_range_start and created_at < v_range_end
        group by (created_at at time zone p_tz)::date
      ) t
    ),
    'utmSourceCounts', (
      select coalesce(jsonb_object_agg(utm_source, cnt), '{}'::jsonb)
      from (
        select utm_source, count(*) as cnt
        from analytics_events
        where event_type = 'page_view'
          and utm_source is not null
          and created_at >= v_range_start and created_at < v_range_end
        group by utm_source
      ) u
    ),
    'utmCampaignCounts', (
      select coalesce(jsonb_object_agg(utm_campaign, cnt), '{}'::jsonb)
      from (
        select utm_campaign, count(*) as cnt
        from analytics_events
        where event_type = 'page_view'
          and utm_campaign is not null
          and created_at >= v_range_start and created_at < v_range_end
        group by utm_campaign
      ) u
    ),
    'conversionCounts', (
      select coalesce(jsonb_object_agg(conversion_type, cnt), '{}'::jsonb)
      from (
        select conversion_type, count(*) as cnt
        from conversions
        where created_at >= v_range_start and created_at < v_range_end
        group by conversion_type
      ) c
    ),
    'topBookingPages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', p, 'clicks', cnt)), '[]'::jsonb)
      from (
        select coalesce(path, '/') as p, count(*) as cnt
        from conversions
        where conversion_type = 'booking_click'
          and created_at >= v_range_start and created_at < v_range_end
        group by coalesce(path, '/')
        order by count(*) desc
        limit 15
      ) t
    ),
    'bookingClicksByDevice', (
      select coalesce(jsonb_object_agg(coalesce(device, 'unknown'), cnt), '{}'::jsonb)
      from (
        select device, count(*) as cnt
        from conversions
        where conversion_type = 'booking_click'
          and created_at >= v_range_start and created_at < v_range_end
        group by device
      ) d
    ),
    'bookingClicksByReferrer', (
      select coalesce(jsonb_agg(jsonb_build_object('source', r, 'visits', cnt)), '[]'::jsonb)
      from (
        select coalesce(referrer_host, 'direct') as r, count(*) as cnt
        from conversions
        where conversion_type = 'booking_click'
          and created_at >= v_range_start and created_at < v_range_end
        group by coalesce(referrer_host, 'direct')
        order by count(*) desc
        limit 15
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function analytics_summary(date, date, text) from public;
revoke execute on function analytics_summary(date, date, text) from anon;
revoke execute on function analytics_summary(date, date, text) from authenticated;
grant execute on function analytics_summary(date, date, text) to service_role;

-- Make PostgREST's schema cache (used by the Supabase JS client's .rpc())
-- aware of the new function immediately, without waiting for its own poll
-- interval or a project restart.
notify pgrst, 'reload schema';

-- =============================================================================
-- STEP 3 — read-only: verify after running STEP 2
-- =============================================================================
-- Compare against STEP 1's baseline for the same range — pageViews/
-- conversions should match exactly (both were well under 1000 in STEP 1's
-- plain count, so this only proves the function's boundary math is
-- correct, not yet that it fixes the cap — that only shows up once a
-- range genuinely exceeds 1000 rows, which this function now handles
-- correctly since it never materializes more than one row of output).
-- select analytics_summary('2026-09-19', '2026-10-18', 'America/New_York');
--
-- -- Confirms the cap itself is gone: pick a 30-day range you know has
-- -- more than 1000 analytics_events rows and compare the function's
-- -- pageViews figure against a plain, uncapped count(*) for the same range.
-- select count(*) from analytics_events
-- where event_type = 'page_view'
--   and created_at >= (('2026-09-19'::date)::timestamp) at time zone 'America/New_York'
--   and created_at <  (('2026-10-19'::date)::timestamp) at time zone 'America/New_York';

-- =============================================================================
-- ROLLBACK (manual — this schema has no automated down-migration tooling;
-- run only if this change ever needs to be reverted)
-- =============================================================================
-- drop function if exists analytics_summary(date, date, text);
