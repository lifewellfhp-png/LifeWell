/**
 * Static schema-contract tests for the marketing_campaign_recipients
 * migration (P4-I5A).
 *
 * This is DDL prepared for OWNER MANUAL EXECUTION in the Supabase SQL
 * editor — it is not applied by this repo's own tooling, and these tests
 * do not connect to any database (no DATABASE_URL/Supabase credential is
 * used here). They assert on the SQL source text itself, the same
 * source-structure pattern used by test-marketing-contacts-schema.mjs
 * (P4-I2A) and test-marketing-campaigns-schema.mjs (P4-I4A).
 *
 *   npx tsx --test scripts/test-marketing-campaign-recipients-schema.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const opsSource = readFileSync(join(root, 'supabase', 'ops.sql'), 'utf8');

const start = opsSource.indexOf('-- P4-I5A: Marketing Campaign Delivery');
const notifyIdx = opsSource.lastIndexOf('notify pgrst');
const end = opsSource.indexOf(';', notifyIdx) + 1;
const block = opsSource.slice(start, end);

// Bounded slice of the P4-I4A campaign block, for the "unchanged status
// CHECK" spot-check — the same technique used in
// test-marketing-contacts-schema.mjs to avoid a stale whole-file match.
const campaignStart = opsSource.indexOf('-- P4-I4A: Marketing Campaign Schema Preparation.');
const campaignBlock = opsSource.slice(campaignStart, start);

test('the marketing_campaign_recipients block exists in ops.sql', () => {
  assert.ok(start > -1, 'expected to find the P4-I5A block');
});

// 1. Table.
test('1. marketing_campaign_recipients table is created (idempotently)', () => {
  assert.match(block, /create table if not exists marketing_campaign_recipients/);
});

// 2. UUID PK/default.
test('2. id is a UUID primary key with a generated default', () => {
  assert.match(block, /id uuid primary key default gen_random_uuid\(\)/);
});

// 3/4. campaign_id / contact_id.
test('3. campaign_id exists as a required uuid', () => {
  assert.match(block, /campaign_id uuid not null references marketing_campaigns \(id\)/);
});

test('4. contact_id exists as a required uuid', () => {
  assert.match(block, /contact_id uuid not null references marketing_contacts \(id\)/);
});

// 5. email_snapshot.
test('5. email_snapshot exists, required and nonblank', () => {
  assert.match(block, /email_snapshot text not null check \(length\(trim\(email_snapshot\)\) > 0\)/);
});

// 6/7. Status.
test('6. delivery status is controlled to exactly pending/processing/sent/failed/skipped', () => {
  assert.match(block, /status in \('pending', 'processing', 'sent', 'failed', 'skipped'\)/);
  // No tracking-engagement states.
  for (const forbidden of ['opened', 'clicked', 'read', 'engaged']) {
    assert.doesNotMatch(block, new RegExp(`'${forbidden}'`));
  }
});

test('7. status defaults to pending', () => {
  const match = block.match(/status text not null default '(\w+)'/);
  assert.ok(match);
  assert.equal(match[1], 'pending');
});

// 8. attempt_count.
test('8. attempt_count is a nonnegative integer defaulting to 0', () => {
  assert.match(block, /attempt_count integer not null default 0 check \(attempt_count >= 0\)/);
});

// 9. Timestamps.
test('9. created_at/updated_at are required with now() defaults; last_attempt_at/sent_at/failed_at are nullable', () => {
  assert.match(block, /created_at timestamptz not null default now\(\)/);
  assert.match(block, /updated_at timestamptz not null default now\(\)/);
  for (const col of ['last_attempt_at', 'sent_at', 'failed_at']) {
    assert.match(block, new RegExp(`${col} timestamptz,`), `expected ${col} to be a nullable timestamptz`);
  }
});

// 10. UNIQUE constraint.
test('10. UNIQUE (campaign_id, contact_id) prevents duplicate delivery records for the same contact', () => {
  assert.match(block, /unique \(campaign_id, contact_id\)/);
});

// 11/12. Foreign keys.
test('11. campaign_id has a foreign key to marketing_campaigns(id) with no cascading delete', () => {
  assert.match(block, /campaign_id uuid not null references marketing_campaigns \(id\),/);
  assert.doesNotMatch(block, /campaign_id[^,]*on delete cascade/i);
});

test('12. contact_id has a foreign key to marketing_contacts(id) with no cascading delete', () => {
  assert.match(block, /contact_id uuid not null references marketing_contacts \(id\),/);
  assert.doesNotMatch(block, /contact_id[^,]*on delete cascade/i);
});

// 13/14. RLS.
test('13. RLS is enabled on marketing_campaign_recipients', () => {
  assert.match(block, /alter table marketing_campaign_recipients enable row level security/);
});

test('14. zero permissive policies are created', () => {
  assert.doesNotMatch(block, /create policy/i);
});

// 15. Campaign lookups are efficiently indexed (via the UNIQUE constraint's
// leading column, not a separate redundant index — a deliberate design
// choice; see the block's own comment).
test('15. campaign_id lookups are covered by an index (the UNIQUE constraint\'s leading column)', () => {
  assert.match(block, /unique \(campaign_id, contact_id\)/);
  assert.match(block, /No separate campaign_id-only index/);
});

// 16. Status index.
test('16. a useful status index exists', () => {
  assert.match(
    block,
    /create index if not exists marketing_campaign_recipients_status_idx on marketing_campaign_recipients \(status\)/
  );
});

// 17. No tracking.
test('17. no open/click/engagement tracking columns exist', () => {
  for (const col of ['open_tracking', 'click_tracking', 'tracking_pixel', 'opened_at', 'clicked_at', 'utm_click_id']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

// 18. No IP/user-agent.
test('18. no IP address or user-agent columns exist', () => {
  assert.doesNotMatch(block, /^\s*ip_address\s/im);
  assert.doesNotMatch(block, /^\s*user_agent\s/im);
});

// 19. No unsubscribe token storage.
test('19. no unsubscribe token/URL storage columns exist', () => {
  for (const col of ['unsubscribe_token', 'unsubscribe_url', 'unsubscribe_token_expiration']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

// 20. No clinical fields.
test('20. no clinical fields exist anywhere in the block', () => {
  assert.doesNotMatch(
    block,
    /^\s*\w*(diagnosis|medication|symptom|clinical_note|treatment_plan|appointment|psychiatric|medical_record)\w*\s+\w+/im
  );
});

// 21. No names snapshot.
test('21. no first_name/last_name (or other profile-field) snapshot columns exist', () => {
  for (const col of ['first_name', 'last_name', 'audience_type', 'consent_source']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

// 22. No raw provider response.
test('22. no raw provider response/request columns exist', () => {
  for (const col of [
    'provider_response',
    'raw_response',
    'response_body',
    'request_body',
    'api_key',
    'authorization_header',
  ]) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

// 23. No email body snapshot.
test('23. no per-recipient email body/message snapshot column exists (only the destination address, email_snapshot)', () => {
  assert.doesNotMatch(block, /^\s*(body|content|message_body|html_snapshot|rendered_content)\s+text/im);
});

// 24. No scheduling fields.
test('24. no scheduling fields exist', () => {
  for (const col of ['scheduled_at', 'cron', 'queue_name', 'run_at']) {
    assert.doesNotMatch(block, new RegExp(`^\\s*${col}\\s`, 'im'));
  }
});

// 25. No destructive SQL.
test('25. the migration contains no destructive DROP/TRUNCATE/DELETE/UPDATE', () => {
  assert.doesNotMatch(block, /\bdrop table\b/i);
  assert.doesNotMatch(block, /\bdrop column\b/i);
  assert.doesNotMatch(block, /\btruncate\b/i);
  assert.doesNotMatch(block, /\bdelete from\b/i);
  assert.doesNotMatch(block, /\bupdate\s+\w+\s+set\b/i);
});

// 26. marketing_contacts / marketing_campaigns not modified.
test('26. neither marketing_contacts nor marketing_campaigns is schema-modified by this block', () => {
  assert.doesNotMatch(block, /alter table marketing_contacts/i);
  assert.doesNotMatch(block, /alter table marketing_campaigns\s/i);
  assert.doesNotMatch(block, /create table if not exists marketing_contacts/i);
  assert.doesNotMatch(block, /create table if not exists marketing_campaigns\b/i);
});

test('marketing_campaigns.status CHECK remains exactly draft/archived — no delivery lifecycle values were added', () => {
  assert.match(campaignBlock, /status in \('draft', 'archived'\)/);
  for (const forbidden of ['sending', 'sent', 'failed', 'scheduled', 'queued', 'cancelled', 'delivered']) {
    assert.doesNotMatch(campaignBlock, new RegExp(`'${forbidden}'`));
  }
});

// 27. No runtime send code anywhere in the repo (the critical deployment
// boundary — this commit must be safe to auto-deploy before the migration
// is applied).
/** Pure-Node recursive scan (no shell-out — cross-platform-safe) for the critical deployment boundary check below. */
function findFilesContaining(dir, needle, hits = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return hits;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      findFilesContaining(full, needle, hits);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry)) {
      const content = readFileSync(full, 'utf8');
      if (content.includes(needle)) hits.push(full);
    }
  }
  return hits;
}

test('27. no runtime code anywhere references marketing_campaign_recipients (the critical deployment boundary)', () => {
  const repoRoot = join(root, '..');
  const hits = [
    ...findFilesContaining(join(repoRoot, 'server', 'src'), 'marketing_campaign_recipients'),
    ...findFilesContaining(join(repoRoot, 'admin', 'src'), 'marketing_campaign_recipients'),
    ...findFilesContaining(join(repoRoot, 'client', 'src'), 'marketing_campaign_recipients'),
  ];
  assert.deepEqual(hits, [], `expected no runtime references, found: ${hits.join(', ')}`);
});
