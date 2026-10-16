/**
 * Regression test for Phase 1 item 6: handleMediaUpload now writes an audit
 * log entry, matching the create/update/delete pattern every other admin
 * mutation in this codebase already follows (see crudFactory.ts). Media
 * uploads go through this dedicated handler, not the generic CRUD router's
 * own POST (which createCrudRouter already audit-logs), so this was the one
 * real coverage gap — see the Phase 1 item 6 scoping discussion for why the
 * other six controllers without writeAuditLog calls (contact, newsletter,
 * chat, analytics, notifications, publicContent) were deliberately left
 * alone: none have an admin-attributed create/update/delete/account-
 * security mutation of the kind this audit log is for.
 *
 * Following this codebase's established convention of verifying Supabase-
 * touching controller logic at the source level (see
 * test-admin-session-lifetime.mjs) rather than stubbing a Supabase client.
 *
 *   npx tsx --test scripts/test-media-audit-log.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'src/controllers/media.controller.ts'), 'utf8');

function sliceFn(name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `${name} must exist`);
  return source.slice(start);
}

test('1. handleMediaUpload imports writeAuditLog', () => {
  assert.match(source, /import \{ writeAuditLog, recordLabel \} from '\.\.\/lib\/audit\.js';/);
});

test('2. the audit log call happens AFTER the media_assets insert succeeds, not before', () => {
  const fn = sliceFn('handleMediaUpload');
  const insertIndex = fn.indexOf(".from('media_assets')");
  const auditIndex = fn.indexOf('writeAuditLog(');
  assert.ok(insertIndex >= 0 && auditIndex >= 0);
  assert.ok(insertIndex < auditIndex, 'insert must happen before the audit log call');
});

test('3. the audit log call happens AFTER the insert-error check (never logs a failed upload as a success)', () => {
  const fn = sliceFn('handleMediaUpload');
  const errorCheckIndex = fn.indexOf('if (error) {');
  const auditIndex = fn.indexOf('writeAuditLog(');
  assert.ok(errorCheckIndex >= 0 && auditIndex >= 0);
  assert.ok(errorCheckIndex < auditIndex);
});

test('4. the audit entry records action "create" and resource "media", matching the generic CRUD router\'s own media entries', () => {
  const fn = sliceFn('handleMediaUpload');
  const callStart = fn.indexOf('writeAuditLog(');
  const call = fn.slice(callStart, callStart + 300);
  assert.match(call, /action:\s*'create'/);
  assert.match(call, /resource:\s*'media'/);
});

test('5. the actor is read from the authenticated request, not hardcoded or omitted', () => {
  const fn = sliceFn('handleMediaUpload');
  assert.match(fn, /const actor = \(req as AuthedRequest\)\.admin;/);
  const callStart = fn.indexOf('writeAuditLog(');
  const call = fn.slice(callStart, callStart + 300);
  assert.match(call, /actor,/);
});
