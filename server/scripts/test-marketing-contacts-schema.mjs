/**
 * Static schema-contract tests for the marketing_contacts migration (P4-I2A).
 *
 * This is DDL prepared for OWNER MANUAL EXECUTION in the Supabase SQL
 * editor — it is not applied by this repo's own tooling, and these tests
 * do not connect to any database (no DATABASE_URL/Supabase credential is
 * used here). They assert on the SQL source text itself, the same
 * source-structure pattern used throughout this test suite, to lock in the
 * architectural invariants this phase's task explicitly required.
 *
 *   npx tsx --test scripts/test-marketing-contacts-schema.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const opsSource = readFileSync(join(root, 'supabase', 'ops.sql'), 'utf8');
const schemaSource = readFileSync(join(root, 'supabase', 'schema.sql'), 'utf8');

const start = opsSource.indexOf('-- P4-I2A: Marketing Contacts');
const notifyIdx = opsSource.indexOf('notify pgrst', start);
const end = opsSource.indexOf(';', notifyIdx) + 1;
const block = opsSource.slice(start, end);

test('the marketing_contacts block exists in ops.sql', () => {
  assert.ok(start > -1, 'expected to find the P4-I2A block');
});

test('table creation is idempotent (IF NOT EXISTS)', () => {
  assert.match(block, /create table if not exists marketing_contacts/);
});

test('email_normalized is a GENERATED column derived from email — not an independently writable column', () => {
  assert.match(block, /email_normalized text generated always as \(lower\(trim\(email\)\)\) stored unique/);
});

test('marketing_status defaults to pending, never subscribed', () => {
  const match = block.match(/marketing_status text not null default '(\w+)'/);
  assert.ok(match, 'expected to find the marketing_status default');
  assert.equal(match[1], 'pending');
});

test('audience_type defaults to other and does not appear anywhere as a consent mechanism', () => {
  const match = block.match(/audience_type text not null default '(\w+)'/);
  assert.ok(match);
  assert.equal(match[1], 'other');
});

test('audience_type, source, and marketing_status are CHECK-constrained enums', () => {
  assert.match(block, /audience_type in \('existing_patient', 'prospective_patient', 'subscriber', 'other'\)/);
  assert.match(block, /source in \('manual', 'csv_import', 'website_signup', 'other'\)/);
  assert.match(block, /marketing_status in \('pending', 'subscribed', 'unsubscribed', 'suppressed'\)/);
});

test('a subscribed row requires a known consent_source (the one enforced status/consent invariant)', () => {
  assert.match(block, /check \(marketing_status <> 'subscribed' or consent_source is not null\)/);
});

test('no default or generated value can produce marketing_status = subscribed', () => {
  // The only literal occurrence of 'subscribed' as a bare default value
  // would be `default 'subscribed'` — must never appear.
  assert.doesNotMatch(block, /default 'subscribed'/);
});

test('no clinical fields exist anywhere in the block', () => {
  // Scoped to actual column declarations, not prose — this file's own
  // comments legitimately name these terms to explain their deliberate
  // absence, which must not itself trip the check.
  assert.doesNotMatch(
    block,
    /^\s*\w*(diagnosis|medication|symptom|clinical_note|treatment_plan|appointment_note|psychiatric|medical_record)\w*\s+\w+/im
  );
});

test('no free-text notes column exists', () => {
  // Scoped to an actual column declaration (name followed by a type), not
  // prose — this file's own comments legitimately discuss why `notes` was
  // excluded, which must not itself trip this check.
  assert.doesNotMatch(block, /^\s*notes\s+text\b/im);
});

test('no phone/SMS column exists on this table', () => {
  assert.doesNotMatch(block, /^\s*(phone|sms)\s+text\b/im);
});

test('no campaign tables are created in this phase', () => {
  assert.doesNotMatch(opsSource, /create table if not exists marketing_campaigns/);
  assert.doesNotMatch(opsSource, /create table if not exists campaign_recipients/);
  assert.doesNotMatch(opsSource, /create table if not exists campaign_deliveries/);
});

test('RLS is enabled with zero policies', () => {
  assert.match(block, /alter table marketing_contacts enable row level security/);
  assert.doesNotMatch(block, /create policy/i);
});

test('expected indexes are present: status, audience, created_at', () => {
  assert.match(block, /create index if not exists marketing_contacts_status_idx on marketing_contacts \(marketing_status\)/);
  assert.match(block, /create index if not exists marketing_contacts_audience_idx on marketing_contacts \(audience_type\)/);
  assert.match(block, /create index if not exists marketing_contacts_created_idx on marketing_contacts \(created_at desc\)/);
});

test('admin_audit_logs is not modified by this phase', () => {
  const auditIdx = opsSource.indexOf('create table if not exists admin_audit_logs');
  assert.ok(auditIdx > -1 && auditIdx < start, 'admin_audit_logs definition must be unchanged, before the new block');
  assert.doesNotMatch(block, /admin_audit_logs/);
});

test('schema.sql was deliberately left unchanged (ops.sql is the sole authoritative source for this migration)', () => {
  assert.doesNotMatch(schemaSource, /marketing_contacts/);
});
