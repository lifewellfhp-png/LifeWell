/**
 * Regression tests for P4-B4 (Paubox-Only Communication Boundary) — Client
 * side. Proves the public Contact form no longer accepts unrestricted
 * visitor-written Subject or Message content, and instead offers a
 * controlled, accessible Reason selector.
 *
 * No React rendering harness exists in this project (no testing-library /
 * jsdom), so — matching every other test in this codebase — these are
 * source-structure checks, not DOM-rendering checks.
 *
 *   npx tsx --test scripts/test-contact-non-clinical-boundary.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { CONTACT_REASONS } from '../src/data/contact.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'src/components/forms/ContactForm.tsx'), 'utf8');
const fieldSource = readFileSync(join(root, 'src/components/forms/Field.tsx'), 'utf8');
const apiSource = readFileSync(join(root, 'src/lib/api.ts'), 'utf8');
const typesSource = readFileSync(join(root, 'src/types/content.ts'), 'utf8');

test('1. no free-text Subject input exists in the Contact UI', () => {
  assert.doesNotMatch(source, /id=\{`\$\{uid\}-subject`\}/);
  assert.doesNotMatch(source, /label="Subject"/);
});

test('2. no free-text Message textarea exists in the Contact UI', () => {
  assert.doesNotMatch(source, /TextAreaField/);
  assert.doesNotMatch(source, /id=\{`\$\{uid\}-message`\}/);
});

test('3. a controlled reason selector exists, sourced from the fixed CONTACT_REASONS list', () => {
  assert.match(source, /import \{ CONTACT_REASONS \} from '@\/data\/contact';/);
  assert.match(source, /<SelectField/);
  assert.match(source, /id=\{`\$\{uid\}-reason`\}/);
  assert.match(source, /options=\{CONTACT_REASONS\.map/);
});

test('the reason list contains only administrative categories — no clinical/symptom/medication/diagnosis options', () => {
  const forbidden = ['symptom', 'diagnos', 'medicat', 'treatment', 'therapy', 'prescription', 'crisis', 'clinical'];
  for (const r of CONTACT_REASONS) {
    for (const word of forbidden) {
      assert.doesNotMatch(r.value.toLowerCase(), new RegExp(word), `reason value "${r.value}" looks clinical`);
      assert.doesNotMatch(r.label.toLowerCase(), new RegExp(word), `reason label "${r.label}" looks clinical`);
    }
  }
  assert.equal(CONTACT_REASONS.length, 5);
});

test('the client-side payload sends `reason`, never `subject`/`message`', () => {
  const submitBlock = source.slice(source.indexOf('const res = await submitContact({'), source.indexOf('});', source.indexOf('const res = await submitContact({')));
  assert.match(submitBlock, /reason:\s*values\.reason/);
  assert.doesNotMatch(submitBlock, /subject:/);
  assert.doesNotMatch(submitBlock, /message:/);
});

test('ContactFormValues/ContactPayload types no longer declare subject/message', () => {
  const contactFormValues = typesSource.slice(
    typesSource.indexOf('export interface ContactFormValues'),
    typesSource.indexOf('}', typesSource.indexOf('export interface ContactFormValues'))
  );
  assert.doesNotMatch(contactFormValues, /subject/);
  assert.doesNotMatch(contactFormValues, /message/);
  assert.match(contactFormValues, /reason: string;/);
  assert.match(apiSource, /export interface ContactPayload extends ContactFormValues/);
});

test('reason is required client-side (validation blocks submission without one)', () => {
  assert.match(source, /if \(!values\.reason\) next\.reason = /);
});

test('SelectField exists in Field.tsx with label/required/error/aria wiring matching the established TextField pattern', () => {
  const selectFieldSource = fieldSource.slice(
    fieldSource.indexOf('export function SelectField'),
    fieldSource.indexOf('export function TextAreaField')
  );
  assert.match(selectFieldSource, /aria-invalid=\{base\.error \? true : undefined\}/);
  assert.match(selectFieldSource, /aria-describedby=\{describedBy\(base\.id, base\.error, base\.hint\)\}/);
  assert.match(selectFieldSource, /required=\{base\.required\}/);
  assert.match(selectFieldSource, /disabled=\{base\.disabled\}/);
  // Reuses the same Wrapper as every other field, so label/required-asterisk/
  // error-message rendering is identical, not reinvented.
  assert.match(selectFieldSource, /<Wrapper \{\.\.\.base\}>/);
});

test('the administrative/privacy guidance is visible and makes no false claims', () => {
  assert.match(source, /scheduling and administrative questions only/i);
  assert.match(source, /do not include medical\s+information/i);
  assert.doesNotMatch(source, /HIPAA/i);
  assert.doesNotMatch(source, /patient portal/i);
  assert.doesNotMatch(source, /this form is (secure|encrypted)/i);
});

test('no hidden field retains legacy free text — no dangerouslySetInnerHTML, no type="hidden" input in the form', () => {
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(source, /type="hidden"/);
});

test('no "Other — explain" style free-text escape hatch was added to the reason selector', () => {
  assert.doesNotMatch(source, /other.{0,20}explain/i);
  assert.doesNotMatch(source, /freeform|free-form|free text/i);
});
