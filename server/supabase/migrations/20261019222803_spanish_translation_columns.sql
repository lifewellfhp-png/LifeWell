-- Migration: Spanish translation columns (_es) for admin-editable content
-- Date: 2026-10-19
-- Author: AI-search-visibility / Spanish-site feature (Part 3)
--
-- BACKGROUND
-- The new Spanish pages at /es/* (client app) currently render static,
-- hand-written Spanish copy (see client/src/data/es/*.ts) — none of it
-- is admin-editable yet. This migration adds the columns needed for
-- staff to start entering/updating Spanish translations through the
-- Admin dashboard for the content types that store translatable text in
-- dedicated plain columns (services, faqs, blog_posts,
-- telehealth_state_pages). site_sections' content is already JSONB, so
-- Spanish text there needs no migration — just a sibling `_es` key in
-- the same JSON object (e.g. content.body / content.body_es).
--
-- IMPORTANT — SCOPE OF THIS MIGRATION
-- This migration only ADDS COLUMNS. It does NOT:
--   - add an admin UI to edit these columns (a separate, already-
--     reviewed code change, not SQL)
--   - wire these columns into what the live /es/* pages actually render
--     (they currently render the static files above, not these columns)
--   - backfill any Spanish text into these columns (every new column is
--     NULL on every existing row)
-- Wiring step 2 (making the live Spanish pages read these columns, with
-- the static files as a fallback when a row's _es column is empty) is a
-- natural follow-up once staff have started filling these in — flagged
-- in the final report, not done in this pass.
--
-- SAFETY
-- - Strictly additive: ADD COLUMN IF NOT EXISTS only, no DROP/RENAME/
--   TRUNCATE, no ALTER ... TYPE, no rewrite of any existing row.
-- - Every new column is nullable with no DEFAULT, so this is a
--   metadata-only change (no table rewrite, no row scan) on every table.
-- - No RLS policy change — these tables already have whatever RLS
--   posture they had before this migration; a new nullable text column
--   doesn't need its own policy.

-- =============================================================================
-- STEP 1 — read-only: inspect the current schema before changing anything
-- =============================================================================
-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('services', 'faqs', 'blog_posts', 'telehealth_state_pages')
--   and column_name like '%\_es' escape '\';
-- -- (expect zero rows before STEP 2 runs)

-- =============================================================================
-- STEP 2 — the migration itself (idempotent; safe to run more than once)
-- =============================================================================

-- services: title, summary, body, seo_title, seo_description are the
-- translatable English columns (see server/supabase/schema.sql).
alter table services add column if not exists title_es text;
alter table services add column if not exists summary_es text;
alter table services add column if not exists body_es text;
alter table services add column if not exists seo_title_es text;
alter table services add column if not exists seo_description_es text;

-- faqs: question, answer.
alter table faqs add column if not exists question_es text;
alter table faqs add column if not exists answer_es text;

-- blog_posts: title, excerpt, body, seo_title, seo_description.
-- author_name is a person's name, not translatable text — no _es column.
alter table blog_posts add column if not exists title_es text;
alter table blog_posts add column if not exists excerpt_es text;
alter table blog_posts add column if not exists body_es text;
alter table blog_posts add column if not exists seo_title_es text;
alter table blog_posts add column if not exists seo_description_es text;

-- telehealth_state_pages: badge, heading, subheading, body, seo_title,
-- seo_description. state_name/state_code/slug are not translatable
-- (slug in particular must stay the same across languages — see the
-- client's routing decision: Spanish pages reuse the exact English
-- slug under an /es prefix, not a translated slug). The `faqs` jsonb
-- array on this table needs no migration — Spanish keys (question_es/
-- answer_es) can be added directly inside its existing JSON objects.
alter table telehealth_state_pages add column if not exists badge_es text;
alter table telehealth_state_pages add column if not exists heading_es text;
alter table telehealth_state_pages add column if not exists subheading_es text;
alter table telehealth_state_pages add column if not exists body_es text;
alter table telehealth_state_pages add column if not exists seo_title_es text;
alter table telehealth_state_pages add column if not exists seo_description_es text;

-- Make PostgREST's schema cache (used by the Supabase JS client) aware
-- of the new columns immediately, without waiting for its own poll
-- interval or a project restart.
notify pgrst, 'reload schema';

-- =============================================================================
-- STEP 3 — read-only: verify after running STEP 2
-- =============================================================================
-- select table_name, column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('services', 'faqs', 'blog_posts', 'telehealth_state_pages')
--   and column_name like '%\_es' escape '\'
-- order by table_name, column_name;
-- -- expect: 5 + 2 + 5 + 6 = 18 rows, every one nullable with no default.
--
-- -- Existing rows should all read NULL for every new column — confirms
-- -- no backfill happened and no table was rewritten with placeholder data.
-- select
--   (select count(*) filter (where title_es is not null) from services) as services_es_filled,
--   (select count(*) filter (where question_es is not null) from faqs) as faqs_es_filled,
--   (select count(*) filter (where title_es is not null) from blog_posts) as blog_posts_es_filled,
--   (select count(*) filter (where heading_es is not null) from telehealth_state_pages) as states_es_filled;
-- -- expect: all zero, until staff start entering translations via the admin UI.

-- =============================================================================
-- ROLLBACK (manual — this schema has no automated down-migration tooling;
-- run only if this change ever needs to be reverted)
-- =============================================================================
-- alter table services drop column if exists title_es;
-- alter table services drop column if exists summary_es;
-- alter table services drop column if exists body_es;
-- alter table services drop column if exists seo_title_es;
-- alter table services drop column if exists seo_description_es;
-- alter table faqs drop column if exists question_es;
-- alter table faqs drop column if exists answer_es;
-- alter table blog_posts drop column if exists title_es;
-- alter table blog_posts drop column if exists excerpt_es;
-- alter table blog_posts drop column if exists body_es;
-- alter table blog_posts drop column if exists seo_title_es;
-- alter table blog_posts drop column if exists seo_description_es;
-- alter table telehealth_state_pages drop column if exists badge_es;
-- alter table telehealth_state_pages drop column if exists heading_es;
-- alter table telehealth_state_pages drop column if exists subheading_es;
-- alter table telehealth_state_pages drop column if exists body_es;
-- alter table telehealth_state_pages drop column if exists seo_title_es;
-- alter table telehealth_state_pages drop column if exists seo_description_es;
