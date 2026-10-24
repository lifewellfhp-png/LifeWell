-- Drop the Spanish translation (_es) columns added by
-- migrations/20261019222803_spanish_translation_columns.sql.
-- Date: 2026-10-24
-- Author: Spanish-site removal follow-up
--
-- BACKGROUND
-- The Spanish site at /es has been removed from the client app (routes,
-- translated copy, the EN|ES switcher, hreflang, /es 301 redirects now in
-- place). The _es columns these pages and the admin FAQs editor used to
-- read/write are no longer referenced by any application code, but the
-- columns — and whatever data is in them — are still sitting on
-- `services`, `faqs`, `blog_posts`, and `telehealth_state_pages`. This
-- script removes those columns.
--
-- THIS SCRIPT HAS NOT BEEN RUN. Nothing here executes until the project
-- owner runs it themselves, after confirming the Spanish content in these
-- columns doesn't need to be kept or exported first.
--
-- SAFETY
-- - Every statement is `DROP COLUMN IF EXISTS`, so this is safe to run
--   even if a given column was never added, or was already dropped.
-- - Wrapped in BEGIN/COMMIT: if anything in STEP 2 fails, Postgres rolls
--   the whole transaction back automatically — no table ends up with only
--   some of its _es columns dropped.
-- - Dropping a column is NOT reversible by this script — the data in it
--   is gone once this commits. The ROLLBACK section at the bottom
--   recreates the empty columns (matching the original migration) if
--   this is ever run by mistake, but it cannot restore the Spanish text
--   that was in them. Export anything worth keeping before running this.

-- =============================================================================
-- STEP 1 — read-only: see what's actually in these columns before dropping
-- =============================================================================
-- select id, question, question_es, answer_es from faqs where question_es is not null or answer_es is not null;
-- select id, title, title_es from services where title_es is not null;
-- select id, title, title_es from blog_posts where title_es is not null;
-- select id, state_name, heading_es from telehealth_state_pages where heading_es is not null;

-- =============================================================================
-- STEP 2 — the drop itself
-- =============================================================================
begin;

alter table services drop column if exists title_es;
alter table services drop column if exists summary_es;
alter table services drop column if exists body_es;
alter table services drop column if exists seo_title_es;
alter table services drop column if exists seo_description_es;

alter table faqs drop column if exists question_es;
alter table faqs drop column if exists answer_es;

alter table blog_posts drop column if exists title_es;
alter table blog_posts drop column if exists excerpt_es;
alter table blog_posts drop column if exists body_es;
alter table blog_posts drop column if exists seo_title_es;
alter table blog_posts drop column if exists seo_description_es;

alter table telehealth_state_pages drop column if exists badge_es;
alter table telehealth_state_pages drop column if exists heading_es;
alter table telehealth_state_pages drop column if exists subheading_es;
alter table telehealth_state_pages drop column if exists body_es;
alter table telehealth_state_pages drop column if exists seo_title_es;
alter table telehealth_state_pages drop column if exists seo_description_es;

notify pgrst, 'reload schema';

commit;

-- =============================================================================
-- STEP 3 — read-only: verify after running STEP 2
-- =============================================================================
-- select table_name, column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('services', 'faqs', 'blog_posts', 'telehealth_state_pages')
--   and column_name like '%\_es' escape '\';
-- -- expect: zero rows.

-- =============================================================================
-- ROLLBACK (manual — recreates the empty columns only; does NOT restore
-- whatever Spanish text was dropped in STEP 2; run only if this script
-- was applied by mistake)
-- =============================================================================
-- begin;
-- alter table services add column if not exists title_es text;
-- alter table services add column if not exists summary_es text;
-- alter table services add column if not exists body_es text;
-- alter table services add column if not exists seo_title_es text;
-- alter table services add column if not exists seo_description_es text;
-- alter table faqs add column if not exists question_es text;
-- alter table faqs add column if not exists answer_es text;
-- alter table blog_posts add column if not exists title_es text;
-- alter table blog_posts add column if not exists excerpt_es text;
-- alter table blog_posts add column if not exists body_es text;
-- alter table blog_posts add column if not exists seo_title_es text;
-- alter table blog_posts add column if not exists seo_description_es text;
-- alter table telehealth_state_pages add column if not exists badge_es text;
-- alter table telehealth_state_pages add column if not exists heading_es text;
-- alter table telehealth_state_pages add column if not exists subheading_es text;
-- alter table telehealth_state_pages add column if not exists body_es text;
-- alter table telehealth_state_pages add column if not exists seo_title_es text;
-- alter table telehealth_state_pages add column if not exists seo_description_es text;
-- notify pgrst, 'reload schema';
-- commit;
