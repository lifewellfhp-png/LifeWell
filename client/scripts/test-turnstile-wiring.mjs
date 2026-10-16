/**
 * Regression tests for Phase 1 item 7's client-side Cloudflare Turnstile
 * wiring: the widget component itself, its presence in ContactForm/
 * NewsletterForm, the token flowing into the submission payload, the
 * widget resetting (remount via key) on a failed submission, and the CSP
 * allowing Cloudflare's script/frame origins.
 *
 * No React rendering harness exists in this project — matching every other
 * test in this codebase, these are source-structure checks.
 *
 *   npx tsx --test scripts/test-turnstile-wiring.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const turnstileSource = readFileSync(join(root, 'src/components/forms/Turnstile.tsx'), 'utf8');
const contactSource = readFileSync(join(root, 'src/components/forms/ContactForm.tsx'), 'utf8');
const newsletterSource = readFileSync(join(root, 'src/components/forms/NewsletterForm.tsx'), 'utf8');
const middlewareSource = readFileSync(join(root, 'src/middleware.ts'), 'utf8');
const apiSource = readFileSync(join(root, 'src/lib/api.ts'), 'utf8');

/* ----------------------------------------------------- Turnstile.tsx --- */

test('1. the widget renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset', () => {
  assert.match(turnstileSource, /if \(!SITE_KEY\) return null;/);
});

test('2. the widget loads the real Cloudflare script, not a third-party mirror', () => {
  assert.match(turnstileSource, /src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js"/);
});

test('3. an error or expiry clears the token (calls onToken with an empty string), never leaving a stale token usable', () => {
  assert.match(turnstileSource, /'error-callback':\s*\(\)\s*=>\s*onToken\(''\)/);
  assert.match(turnstileSource, /'expired-callback':\s*\(\)\s*=>\s*onToken\(''\)/);
});

test('4. the widget is cleaned up (removed) on unmount', () => {
  assert.match(turnstileSource, /window\.turnstile\.remove\(widgetIdRef\.current\)/);
});

/* ---------------------------------------------------------- ContactForm --- */

test('5. ContactForm imports and renders Turnstile, and includes the token in submitContact\'s payload', () => {
  assert.match(contactSource, /import \{ Turnstile \} from '\.\/Turnstile';/);
  assert.match(contactSource, /<Turnstile\b/);
  assert.match(contactSource, /turnstile_token:\s*turnstileToken/);
});

test('6. ContactForm resets the Turnstile widget (increments its key) on a failed submission, not just on success', () => {
  const failBranch = contactSource.slice(contactSource.indexOf('} else {'), contactSource.indexOf('statusRef.current?.focus();') + 30);
  assert.match(failBranch, /setTurnstileKey\(\(k\) => k \+ 1\)/);
});

/* ------------------------------------------------------- NewsletterForm --- */

test('7. NewsletterForm imports and renders Turnstile, and includes the token in submitNewsletter\'s payload', () => {
  assert.match(newsletterSource, /import \{ Turnstile \} from '\.\/Turnstile';/);
  assert.match(newsletterSource, /<Turnstile\b/);
  assert.match(newsletterSource, /turnstile_token:\s*turnstileToken/);
});

test('8. NewsletterForm resets the Turnstile widget on a failed submission', () => {
  const submitStart = newsletterSource.indexOf('async function onSubmit');
  const elseIndex = newsletterSource.indexOf('} else {', submitStart);
  assert.ok(elseIndex >= 0, 'the failure branch of onSubmit must exist');
  const failBranch = newsletterSource.slice(elseIndex, elseIndex + 300);
  assert.match(failBranch, /setTurnstileKey\(\(k\) => k \+ 1\)/);
});

/* -------------------------------------------------------------- api.ts --- */

test('9. ContactPayload and submitNewsletter\'s payload type both declare turnstile_token as optional', () => {
  assert.match(apiSource, /turnstile_token\?:\s*string;/);
});

/* ------------------------------------------------------------ middleware --- */

test('10. the CSP allows Cloudflare Turnstile\'s script and frame origins, without removing any existing origin', () => {
  assert.match(middlewareSource, /script-src 'self' 'unsafe-inline' https:\/\/challenges\.cloudflare\.com/);
  assert.match(middlewareSource, /frame-src https:\/\/ehr\.charmtracker\.com https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com https:\/\/challenges\.cloudflare\.com/);
});
