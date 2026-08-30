/**
 * Regression tests for P4-F2 (Visible Contact-Form Sensitive-Information
 * Warning).
 *
 * P4-F1 corrected the warning's wording but missed that it was gated behind
 * `{!compact && (...)}`, and every real ContactForm call site in the app
 * uses variant="compact" — so the corrected warning never actually
 * rendered. Both variants render the message textarea unconditionally, so
 * per this phase's rule both must render the warning too.
 *
 * No React rendering harness exists in this project (no testing-library /
 * jsdom), so — matching every other test in this codebase — these are
 * source-structure checks, not DOM-rendering checks.
 *
 *   npx tsx --test scripts/test-contact-privacy-warning-visible.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'src/components/forms/ContactForm.tsx'), 'utf8');
const apiSource = readFileSync(join(root, 'src/lib/api.ts'), 'utf8');

test('A/B. the warning block is the unconditional first child of <form> — renders for both compact and full variants', () => {
  // The old, broken shape gated the warning behind `!compact`. Prove that
  // shape is gone...
  assert.doesNotMatch(
    source,
    /\{!compact\s*&&\s*\(\s*<div className="rounded-md border border-border-subtle/,
    'the warning must not be conditionally rendered only for the non-compact variant'
  );
  // ...and that the warning now appears as the first thing inside <form>,
  // with nothing gating it before the sensitive-info text.
  assert.match(
    source,
    /<form[^>]*>\s*<div className="rounded-md border border-border-subtle bg-surface-muted px-5 py-4">\s*<p className="text-sm text-text-secondary">/,
    'the warning div must be the unconditional first child of <form>'
  );
});

test('C. the warning tells visitors not to include sensitive medical/personal health information', () => {
  assert.match(source, /do not include/i);
  assert.match(source, /sensitive medical or personal health information/i);
});

test('D. the warning references the existing centralized office phone data, not a hardcoded second number', () => {
  assert.match(source, /please call our office at/i);
  assert.match(source, /site\.contact\.phoneHref/);
  assert.match(source, /\{site\.contact\.phone\}/);
});

test('E. no "secure patient portal" wording exists', () => {
  assert.doesNotMatch(source, /patient portal/i);
});

test('F. no HIPAA-compliance claim (or other forbidden phrase) is introduced', () => {
  assert.doesNotMatch(source, /HIPAA/i);
  assert.doesNotMatch(source, /encrypted messaging/i);
});

test('G. the free-text message field remains present and is never gated behind a variant conditional', () => {
  // The message TextAreaField sits as a direct, unconditional sibling
  // immediately after the two-column name/email grid closes — never inside
  // a `{!compact && (...)}` block. This has always been true; this phase
  // must not change it.
  assert.match(
    source,
    /<\/div>\s*<TextAreaField\s*\n\s*id=\{`\$\{uid\}-message`\}/,
    'the message field must be an unconditional sibling, not gated behind a variant check'
  );
});

test('H. the submission endpoint/action is unchanged', () => {
  assert.match(source, /submitContact/);
  assert.match(source, /onSubmit=\{onSubmit\}/);
  assert.match(apiSource, /submitContact = \(payload: ContactPayload\) => post\('\/api\/contact', payload\)/);
});

test('I. booking functionality/data is untouched by this phase', () => {
  const siteSource = readFileSync(join(root, 'src/data/site.ts'), 'utf8');
  assert.match(siteSource, /charmtracker\.com/);
});
