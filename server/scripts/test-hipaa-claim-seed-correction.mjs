/**
 * Regression test for P4-F1's correction of the live-import seed content in
 * importLive.controller.ts. This file seeds CMS content (FAQs, benefit
 * tiles) via the idempotent live-import endpoint — its FAQ/benefit text
 * mirrored the same unsupported "HIPAA-compliant" claim already corrected in
 * client/src/data/marketing.ts. Left uncorrected, a future re-import would
 * silently reintroduce the claim into the CMS. This is a source-text check
 * (not a live-import invocation, which requires Supabase and admin auth).
 *
 *   npx tsx --test scripts/test-hipaa-claim-seed-correction.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'src/controllers/importLive.controller.ts'), 'utf8');

test('A. the live-import FAQ/benefit seed content no longer claims HIPAA compliance', () => {
  assert.doesNotMatch(source, /HIPAA[- ]compliant/i);
});

test('B. the confidentiality FAQ answer and secure-sessions benefit description are still present, just reworded', () => {
  assert.match(source, /Are telehealth sessions confidential\?/);
  assert.match(source, /Private & Secure Telehealth Sessions/);
});

test('C. this phase did not touch SMTP, contact persistence, or auth logic in the server app', () => {
  assert.doesNotMatch(source, /nodemailer|sendMail|storeLead|jwt|bcrypt/i);
});
