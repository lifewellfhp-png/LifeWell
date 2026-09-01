/**
 * Static schema-contract tests for the marketing_campaigns migration
 * (P4-I4A).
 *
 * This is DDL prepared for OWNER MANUAL EXECUTION in the Supabase SQL
 * editor — it is not applied by this repo's own tooling, and these tests
 * do not connect to any database (no DATABASE_URL/Supabase credential is
 * used here). They assert on the SQL source text itself, the same
 * source-structure pattern used by test-marketing-contacts-schema.mjs
 * (P4-I2A), to lock in the architectural invariants this phase's task
 * explicitly required — chiefly that this table is schema preparation
 * only: draft content and audience-selection criteria, with no recipient,
 * delivery, event, provider, tracking, or unsubscribe-token surface.
 *
 *   npx tsx --test scripts/test-marketing-campaigns-schema.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const opsSource = readFileSync(join(root, 'supabase', 'ops.sql'), 'utf8');

const start = opsSource.indexOf('-- P4-I4A: Marketing Campaign Schema Preparation.');
const notifyIdx = opsSource.indexOf('notify pgrst', start);
const end = opsSource.indexOf(';', notifyIdx) + 1;
const block = opsSource.slice(start, end);

test('the marketing_campaigns block exists in ops.sql', () => {
  assert.ok(start > -1, 'expected to find the P4-I4A block');
});

// 1. Table is created.
test('1. marketing_campaigns table is created (idempotently)', () => {
  assert.match(block, /create table if not exists marketing_campaigns/);
});

// 2. UUID primary key/default.
test('2. id is a UUID primary key with a generated default', () => {
  assert.match(block, /id uuid primary key default gen_random_uuid\(\)/);
});

// 3-6. Required text fields.
test('3. name exists, required and nonblank, bounded to 200 chars', () => {
  assert.match(block, /name text not null check \(length\(trim\(name\)\) > 0 and length\(name\) <= 200\)/);
});

test('4. subject exists, required and nonblank, bounded to 200 chars', () => {
  assert.match(block, /subject text not null check \(length\(trim\(subject\)\) > 0 and length\(subject\) <= 200\)/);
});

test('5. preview_text exists, nullable, bounded to 500 chars', () => {
  assert.match(block, /preview_text text check \(preview_text is null or length\(preview_text\) <= 500\)/);
});

test('6. content exists, required and nonblank, with no small arbitrary upper bound', () => {
  assert.match(block, /content text not null check \(length\(trim\(content\)\) > 0\)/);
  // Confirms the deliberate choice not to cap content length — only the
  // nonblank check exists for this column, no "<= N" bound.
  const contentLine = block.match(/content text not null check \([^)]*\)/)[0];
  assert.doesNotMatch(contentLine, /<=/);
});

// 7-9. Status model.
test('7. status exists', () => {
  assert.match(block, /status text not null default '(\w+)'/);
});

test('8. status defaults to draft', () => {
  const match = block.match(/status text not null default '(\w+)'/);
  assert.ok(match);
  assert.equal(match[1], 'draft');
});

test('9. only draft/archived statuses are allowed — no delivery-lifecycle states', () => {
  assert.match(block, /status in \('draft', 'archived'\)/);
  for (const forbidden of [
    'scheduled',
    'queued',
    'sending',
    'sent',
    'delivered',
    'failed',
    'cancelled',
  ]) {
    assert.doesNotMatch(block, new RegExp(`'${forbidden}'`));
  }
});

// 10-11. Audience model.
test('10. audience_type exists', () => {
  assert.match(block, /audience_type text/);
});

test('11. audience_type is nullable and, when set, controlled to the same four values as marketing_contacts', () => {
  assert.match(
    block,
    /audience_type is null or audience_type in \('existing_patient', 'prospective_patient', 'subscriber', 'other'\)/
  );
});

// 12. created_by.
test('12. created_by exists as a nullable uuid with no foreign key', () => {
  assert.match(block, /created_by uuid,/);
  assert.doesNotMatch(block, /created_by uuid.*references/);
});

// 13-14. Timestamps.
test('13. created_at exists, not null, defaults to now()', () => {
  assert.match(block, /created_at timestamptz not null default now\(\)/);
});

test('14. updated_at exists, not null, defaults to now()', () => {
  assert.match(block, /updated_at timestamptz not null default now\(\)/);
});

// 15. archived_at.
test('15. archived_at exists and is nullable (no NOT NULL)', () => {
  assert.match(block, /archived_at timestamptz\r?\n\);/);
});

// 16-17. RLS.
test('16. RLS is enabled on marketing_campaigns', () => {
  assert.match(block, /alter table marketing_campaigns enable row level security/);
});

test('17. zero permissive policies are created', () => {
  assert.doesNotMatch(block, /create policy/i);
});

// 18-19. Indexes.
test('18. a useful status index exists', () => {
  assert.match(block, /create index if not exists marketing_campaigns_status_idx on marketing_campaigns \(status\)/);
});

test('19. a useful created_at index exists', () => {
  assert.match(
    block,
    /create index if not exists marketing_campaigns_created_idx on marketing_campaigns \(created_at desc\)/
  );
});

// 20-22. No recipient/delivery/event tables.
test('20. no recipient table is created by the P4-I4A block itself', () => {
  // Scoped to this phase's own block, not the whole file — P4-I5A later
  // adds marketing_campaign_recipients in its own separate block further
  // down ops.sql (explicitly authorized, and covered by its own
  // test-marketing-campaign-recipients-schema.mjs). "campaign_recipients"
  // (the alternate name never used) remains checked file-wide since it
  // genuinely does not exist anywhere.
  assert.doesNotMatch(block, /create table if not exists marketing_campaign_recipients\b/);
  assert.doesNotMatch(opsSource, /create table if not exists campaign_recipients\b/);
});

test('21. no delivery table is created', () => {
  for (const name of ['marketing_campaign_deliveries', 'campaign_deliveries']) {
    assert.doesNotMatch(opsSource, new RegExp(`create table if not exists ${name}\\b`));
  }
});

test('22. no campaign event/click/open/job/queue table is created', () => {
  for (const name of [
    'marketing_campaign_events',
    'campaign_events',
    'campaign_clicks',
    'campaign_opens',
    'campaign_jobs',
    'campaign_queue',
  ]) {
    assert.doesNotMatch(opsSource, new RegExp(`create table if not exists ${name}\\b`));
  }
});

// 23-24. No recipient snapshot / authoritative count.
test('23. no recipient email/id snapshot column exists', () => {
  for (const col of ['recipient_ids', 'recipient_emails', 'recipient_list', 'recipient_snapshot']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

test('24. no authoritative recipient_count column exists', () => {
  assert.doesNotMatch(block, /^\s*recipient_count\s/im);
});

// 25-27. No delivery/scheduling/metric fields.
test('25. no sent_at column exists', () => {
  assert.doesNotMatch(block, /^\s*sent_at\s/im);
});

test('26. no scheduled_at (or other delivery-lifecycle timestamp) column exists', () => {
  for (const col of ['scheduled_at', 'send_started_at', 'completed_at', 'delivered_at']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

test('27. no delivery metric columns exist', () => {
  for (const col of [
    'sent_count',
    'delivered_count',
    'failed_count',
    'opened_count',
    'clicked_count',
    'unsubscribed_count',
  ]) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

// 28-29. No provider IDs/configuration.
test('28. no provider message/campaign ID columns exist', () => {
  for (const col of ['provider_message_id', 'provider_campaign_id', 'paubox_id', 'mailchimp_id', 'convertkit_id']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

test('29. no provider configuration columns exist', () => {
  for (const col of ['email_provider', 'from_email', 'smtp_config', 'api_key', 'template_provider_id']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
  assert.doesNotMatch(block, /^\s*provider\s+text/im);
});

// 30. No unsubscribe token storage.
test('30. no unsubscribe token/url storage columns exist', () => {
  for (const col of ['unsubscribe_token', 'unsubscribe_url', 'unsubscribe_token_expiration']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

// 31-32. No clinical fields / patient FK.
test('31. no clinical fields exist anywhere in the block', () => {
  // Scoped to actual column declarations, not prose — this block's own
  // comments legitimately name these terms to explain their deliberate
  // absence, which must not itself trip the check.
  assert.doesNotMatch(
    block,
    /^\s*\w*(diagnosis|medication|symptom|clinical_note|treatment_plan|appointment_note|psychiatric|medical_record)\w*\s+\w+/im
  );
});

test('32. no patient identifier or patient-record foreign key exists', () => {
  for (const col of ['patient_id', 'medical_record_number']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
  assert.doesNotMatch(block, /references patients/i);
  assert.doesNotMatch(block, /^\s*(dob|condition|clinical_segment)\s/im);
});

// 33. No destructive SQL.
test('33. the migration contains no destructive DROP/TRUNCATE/DELETE/UPDATE', () => {
  assert.doesNotMatch(block, /\bdrop table\b/i);
  assert.doesNotMatch(block, /\bdrop column\b/i);
  assert.doesNotMatch(block, /\btruncate\b/i);
  assert.doesNotMatch(block, /\bdelete from\b/i);
  assert.doesNotMatch(block, /\bupdate\s+\w+\s+set\b/i);
});

// 34. marketing_contacts is not touched by this block.
test('34. the marketing_contacts schema is not modified by the campaign block', () => {
  // The block's own comments legitimately reference marketing_contacts in
  // prose (explaining the audience_type/consent relationship) — what must
  // never appear is an actual schema-modifying statement against it.
  assert.doesNotMatch(block, /alter table marketing_contacts/i);
  assert.doesNotMatch(block, /drop table marketing_contacts/i);
  assert.doesNotMatch(block, /update marketing_contacts/i);
  assert.doesNotMatch(block, /insert into marketing_contacts/i);
  assert.doesNotMatch(block, /create table if not exists marketing_contacts/i);
});

// Supplementary: idempotent additive migration, matching repo convention.
test('the migration is purely additive (create table/index, alter ... enable RLS, notify) — nothing else', () => {
  assert.match(block, /alter table marketing_campaigns enable row level security/);
  assert.doesNotMatch(block, /alter table marketing_campaigns\s+(add|drop|alter) column/i);
});

test('the block ends with a PostgREST schema-reload notification, matching the established convention', () => {
  assert.match(block.trimEnd(), /notify pgrst, 'reload schema';$/);
});
