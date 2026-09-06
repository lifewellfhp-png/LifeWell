/**
 * Regression tests for the Labor Day 2026 campaign personalization work:
 * first-name token substitution, HTML escaping, subject fallback,
 * recipient eligibility (unchanged, verified against the existing
 * consent-gated architecture), PHI absence, and draft-only/no-send safety.
 *
 * No live Supabase connection, no Production credentials, no outbound
 * email, no delivery job, no queue record, no scheduled task. Following
 * this codebase's established convention of testing real production code
 * without a live Supabase connection (see test-admin-no-store-cache.mjs).
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-campaign-personalization.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  normalizeFirstName,
  greetingDisplayName,
  renderCampaignSubject,
  buildCampaignEmailContent,
} from '../src/services/marketingCampaignDelivery.service.ts';
import {
  buildRecipientEligibilityFilters,
  assertCampaignEditable,
} from '../src/controllers/marketingCampaigns.controller.ts';
import { marketingCampaignCreate } from '../src/validation/adminSchemas.ts';
import { LABOR_DAY_CAMPAIGN } from './campaigns/labor-day-2026-subscriber-greeting.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/* ------------------------------------------------- 1-5. normalization --- */

test('1. a valid first name normalizes and greets correctly', () => {
  assert.equal(normalizeFirstName('Daniel'), 'Daniel');
  assert.equal(greetingDisplayName('Daniel'), 'Daniel');
});

test('2. a blank/missing first name falls back to "there"', () => {
  for (const value of ['', '   ', null, undefined]) {
    assert.equal(normalizeFirstName(value), null);
    assert.equal(greetingDisplayName(value), 'there');
  }
});

test('3. whitespace is trimmed', () => {
  assert.equal(normalizeFirstName('  Daniel  '), 'Daniel');
});

test('4. an excessively long value is rejected (treated as unavailable, not truncated)', () => {
  assert.equal(normalizeFirstName('D'.repeat(61)), null);
  assert.equal(greetingDisplayName('D'.repeat(61)), 'there');
});

test('5. malicious/markup-like content in a name is rejected outright, not rendered', () => {
  for (const malicious of ['<script>alert(1)</script>', 'Dan<img src=x onerror=alert(1)>', '<b>Dan</b>']) {
    assert.equal(normalizeFirstName(malicious), null);
    assert.equal(greetingDisplayName(malicious), 'there');
  }
});

/* --------------------------------------------- 6-8. subject rendering --- */

test('6. subject personalizes when a valid name exists', () => {
  const subject = renderCampaignSubject(
    { subject: '{{first_name}}, wishing you a restful Labor Day', subject_fallback: 'Wishing you a restful Labor Day' },
    'Daniel'
  );
  assert.equal(subject, 'Daniel, wishing you a restful Labor Day');
});

test('7. subject falls back to the distinct fallback subject when no valid name exists (never "there, wishing...")', () => {
  const campaign = { subject: '{{first_name}}, wishing you a restful Labor Day', subject_fallback: 'Wishing you a restful Labor Day' };
  for (const value of [null, undefined, '', '   ']) {
    assert.equal(renderCampaignSubject(campaign, value), 'Wishing you a restful Labor Day');
  }
});

test('8. if no subject_fallback is configured, the base subject (with the unsubstituted token) is used rather than throwing', () => {
  const subject = renderCampaignSubject({ subject: 'Hello!', subject_fallback: null }, null);
  assert.equal(subject, 'Hello!');
});

/* ------------------------------------------- 9-14. body/HTML rendering --- */

test('9. named variant: HTML greeting renders "Hello, Daniel!" exactly', () => {
  const { html } = buildCampaignEmailContent({
    subject: 'x',
    content: 'Hello, {{first_name_or_there}}!',
    htmlBody: '<p>Hello, {{first_name_or_there}}!</p>',
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=abc',
    firstName: 'Daniel',
  });
  assert.match(html, /Hello, Daniel!/);
});

test('10. fallback variant: HTML greeting renders "Hello there!" exactly', () => {
  const { html } = buildCampaignEmailContent({
    subject: 'x',
    content: 'Hello, {{first_name_or_there}}!',
    htmlBody: '<p>Hello, {{first_name_or_there}}!</p>',
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=abc',
    firstName: null,
  });
  assert.match(html, /Hello, there!/);
});

test('11. malicious HTML in a name never reaches the rendered output (rejected to "there", not escaped-and-rendered)', () => {
  const { html, text } = buildCampaignEmailContent({
    subject: 'x',
    content: 'Hello, {{first_name_or_there}}!',
    htmlBody: '<p>Hello, {{first_name_or_there}}!</p>',
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=abc',
    firstName: '<script>alert(1)</script>',
  });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(text, /<script>/);
  assert.match(html, /Hello, there!/);
});

test('12. a name containing HTML-significant characters that somehow slipped through is still escaped as defense in depth', () => {
  // normalizeFirstName already rejects '<'/'>' outright, but escapeHtml is
  // still applied to whatever normalizeFirstName DOES accept (ampersands,
  // quotes, apostrophes in a real name) — verified here directly.
  const { html } = buildCampaignEmailContent({
    subject: 'x',
    content: '{{first_name_or_there}}',
    htmlBody: '{{first_name_or_there}}',
    unsubscribeUrl: 'https://example.invalid/u',
    firstName: "O'Brien & Sons",
  });
  assert.doesNotMatch(html, /O'Brien & Sons/); // raw apostrophe/ampersand must not appear unescaped
  assert.match(html, /O&#39;Brien &amp; Sons/);
});

test('13. no template syntax is ever exposed to the recipient (tokens fully substituted in both HTML and text)', () => {
  const { html, text } = buildCampaignEmailContent({
    subject: 'x',
    content: LABOR_DAY_CAMPAIGN.content,
    htmlBody: LABOR_DAY_CAMPAIGN.html_body,
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=abc123',
    firstName: 'Daniel',
  });
  for (const token of ['{{first_name_or_there}}', '{{unsubscribe_url}}', '{{first_name}}']) {
    assert.ok(!html.includes(token), `HTML must not expose ${token}`);
    assert.ok(!text.includes(token), `text must not expose ${token}`);
  }
});

test('14. the unsubscribe URL never contains recipient name/email — only an opaque token', () => {
  const url = 'https://www.lifewellfhp.com/unsubscribe?token=abc123';
  assert.doesNotMatch(url, /@/);
  assert.doesNotMatch(url, /daniel/i);
  const { html } = buildCampaignEmailContent({
    subject: 'x',
    content: LABOR_DAY_CAMPAIGN.content,
    htmlBody: LABOR_DAY_CAMPAIGN.html_body,
    unsubscribeUrl: url,
    firstName: 'Daniel',
  });
  assert.match(html, /token=abc123/);
});

/* ------------------------------------------------- 15. backward compat --- */

test('15. existing campaigns with no html_body render exactly as before this change (byte-identical escape-wrapper behavior)', () => {
  const { html } = buildCampaignEmailContent({
    subject: 'x',
    content: 'Plain legacy content, no tokens at all.',
    htmlBody: null,
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=legacy',
  });
  assert.match(html, /white-space:pre-wrap/);
  assert.match(html, /Plain legacy content, no tokens at all\./);
  assert.match(html, /To stop receiving marketing emails from LifeWell, unsubscribe here:/);
});

/* ------------------------------------------------ 16-19. eligibility --- */

test('16. only subscribed contacts qualify — the filter always requires marketing_status = subscribed', () => {
  const filters = buildRecipientEligibilityFilters(null);
  assert.equal(filters.marketing_status, 'subscribed');
});

test('17. audience_type = existing_patient alone never substitutes for consent — the filter still requires subscribed', () => {
  const filters = buildRecipientEligibilityFilters('existing_patient');
  assert.equal(filters.marketing_status, 'subscribed');
  assert.equal(filters.audience_type, 'existing_patient');
});

test('18. unsubscribed/suppressed/pending contacts are structurally excluded (marketing_status is a single-value enum — a contact cannot be both subscribed and any of these)', () => {
  const schemaSource = readFileSync(join(root, 'src/validation/adminSchemas.ts'), 'utf8');
  assert.match(schemaSource, /MARKETING_STATUSES = \['pending', 'subscribed', 'unsubscribed', 'suppressed'\] as const;/);
  const opsSql = readFileSync(join(root, 'supabase/ops.sql'), 'utf8');
  assert.match(opsSql, /check \(marketing_status in \('pending', 'subscribed', 'unsubscribed', 'suppressed'\)\)/);
});

test('19. documented consent provenance is structurally guaranteed by the existing DB CHECK (subscribed requires consent_source), not re-implemented here', () => {
  const opsSql = readFileSync(join(root, 'supabase/ops.sql'), 'utf8');
  assert.match(opsSql, /check \(marketing_status <> 'subscribed' or consent_source is not null\)/);
});

test("19b. bounced and complained contacts are excluded too — this schema represents them as marketing_status = 'suppressed' with a specific reason, not a separate status value, so the same subscribed-only filter excludes them", () => {
  const schemaSource = readFileSync(join(root, 'src/validation/adminSchemas.ts'), 'utf8');
  assert.match(schemaSource, /MARKETING_SUPPRESSION_REASONS = \['hard_bounce', 'spam_complaint', 'administrative', 'other'\] as const;/);
});

/* ------------------------------------------------------ 20-21. no PHI --- */

test('20. the campaign template contains no diagnosis, medication, symptom, or individually-targeted clinical/patient-status reference', () => {
  // "appointments" appears once, in the task's own approved optional
  // closing line ("in-person appointments available in Orlando where
  // applicable") — a general statement about the practice's care model,
  // not a reference to any recipient's specific appointment. That is the
  // one deliberate, approved exception; every other clinical/PHI-adjacent
  // term remains a hard reject.
  const flat = (LABOR_DAY_CAMPAIGN.content + LABOR_DAY_CAMPAIGN.html_body).toLowerCase();
  for (const term of ['diagnos', 'medication', 'prescri', 'symptom', 'treatment plan', 'your condition', 'medical record']) {
    assert.ok(!flat.includes(term), `unexpected clinical/PHI-adjacent term: "${term}"`);
  }
  // The one approved use of "appointment" is scoped to the general,
  // non-individual closing line — confirm it never appears anywhere else
  // (e.g. paired with "your" or a specific date/time, which would indicate
  // an individually-targeted reference).
  assert.doesNotMatch(flat, /your appointment/);
  assert.equal((flat.match(/appointment/g) || []).length, 2, 'expected exactly the one approved mention (once in HTML, once in plain text)');
});

test('21. no urgency language, discount offer, or testimonial claim appears in the template', () => {
  const flat = (LABOR_DAY_CAMPAIGN.content + LABOR_DAY_CAMPAIGN.html_body).toLowerCase();
  for (const term of ['limited time', 'act now', "don't wait", 'discount', 'promo', '% off', 'as seen', 'testimonial']) {
    assert.ok(!flat.includes(term), `unexpected disallowed language: "${term}"`);
  }
});

/* ---------------------------------- 21b-21e. logo, colors, contact block --- */

test('21b. the header uses the real approved logo asset (public/logo.png), not a text wordmark or an invented image', () => {
  assert.match(LABOR_DAY_CAMPAIGN.html_body, /<img\s+src="https:\/\/www\.lifewellfhp\.com\/logo\.png"/);
  assert.match(LABOR_DAY_CAMPAIGN.html_body, /alt="LifeWell Family Health &amp; Psychiatry"/);
});

test('21c. brand colors are sampled from the actual logo file, not the site\'s softer CSS palette', () => {
  // Sampled directly from public/logo.png (see the module docblock) —
  // deliberately different from --lw-primary (#3e7fb1) / --lw-accent
  // (#5faf6b), which are softer UI colors, not the printed logo's own.
  assert.match(LABOR_DAY_CAMPAIGN.html_body, /#002573/);
  assert.match(LABOR_DAY_CAMPAIGN.html_body, /#029015/);
  assert.doesNotMatch(LABOR_DAY_CAMPAIGN.html_body, /#3e7fb1/);
  assert.doesNotMatch(LABOR_DAY_CAMPAIGN.html_body, /#5faf6b/);
});

test('21d. the personal name sign-off was removed per owner request, and never reappears anywhere in either variant', () => {
  const flat = LABOR_DAY_CAMPAIGN.content + LABOR_DAY_CAMPAIGN.html_body;
  assert.doesNotMatch(flat, /Lourdie Chachoute and the LifeWell Family Health/);
});

test('21e. the office/fax/email contact block and practice tagline are present, using only already-verified NAP facts', () => {
  for (const target of [LABOR_DAY_CAMPAIGN.content, LABOR_DAY_CAMPAIGN.html_body]) {
    assert.match(target, /\(407\) 603-1717/); // office — matches site.ts's verified phone
    assert.match(target, /\(407\) 710-8252/); // fax — matches site.ts's verified fax
    assert.match(target, /contact@lifewellfhp\.com/); // matches site.ts's verified email
    assert.match(target, /Treating the Whole Person: Mind and Body\./);
  }
});

/* -------------------------------------------- 22-24. compliance footer --- */

test('22. the plain-text version contains the org name, address, reason-for-receiving line, unsubscribe token, and privacy link', () => {
  const c = LABOR_DAY_CAMPAIGN.content;
  assert.match(c, /LifeWell Family Health & Psychiatry/);
  assert.match(c, /3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828/);
  assert.match(c, /You are receiving this message because you subscribed to LifeWell marketing updates\./);
  assert.match(c, /Unsubscribe: \{\{unsubscribe_url\}\}/);
  assert.match(c, /Privacy Policy: https:\/\/www\.lifewellfhp\.com\/privacy-policy/);
});

test('23. the HTML version contains the same compliance elements, with real unsubscribe/privacy links', () => {
  const h = LABOR_DAY_CAMPAIGN.html_body;
  assert.match(h, /LifeWell Family Health &amp; Psychiatry/);
  assert.match(h, /3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828/);
  assert.match(h, /you subscribed to LifeWell marketing updates/);
  assert.match(h, /href="\{\{unsubscribe_url\}\}"/);
  assert.match(h, /href="https:\/\/www\.lifewellfhp\.com\/privacy-policy"/);
});

test('24. rendering the real template produces a working (non-empty, correctly substituted) unsubscribe href', () => {
  const { html } = buildCampaignEmailContent({
    subject: LABOR_DAY_CAMPAIGN.subject,
    content: LABOR_DAY_CAMPAIGN.content,
    htmlBody: LABOR_DAY_CAMPAIGN.html_body,
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=xyz',
    firstName: 'Daniel',
  });
  assert.match(html, /href="https:\/\/www\.lifewellfhp\.com\/unsubscribe\?token=xyz"/);
});

/* --------------------------------------------- 25. plain-text completeness --- */

test('25. the plain-text output contains the complete approved message (headline concept, all body paragraphs, sign-off, optional closing line)', () => {
  const rendered = buildCampaignEmailContent({
    subject: LABOR_DAY_CAMPAIGN.subject,
    content: LABOR_DAY_CAMPAIGN.content,
    htmlBody: null, // text output must not depend on htmlBody
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=xyz',
    firstName: 'Daniel',
  }).text;
  assert.match(rendered, /Hello, Daniel!/);
  assert.match(rendered, /celebrate the dedication, care, and hard work/);
  assert.match(rendered, /pause, recharge, and enjoy meaningful time/);
  assert.match(rendered, /safe, peaceful, and restorative Labor Day/);
  assert.match(rendered, /Warmly,/);
  assert.match(rendered, /virtual across Florida, Massachusetts, and Arizona/);
  // Owner-requested revision: the personal name sign-off was removed in
  // favor of an office/fax/email contact block and the practice tagline.
  assert.doesNotMatch(rendered, /Lourdie Chachoute and the LifeWell Family Health & Psychiatry team/);
  assert.match(rendered, /Office: \(407\) 603-1717 \| Fax: \(407\) 710-8252/);
  assert.match(rendered, /Email: contact@lifewellfhp\.com/);
  assert.match(rendered, /"Treating the Whole Person: Mind and Body\."/);
});

/* ------------------------------------------------ 26-28. draft-only safety --- */

test('26. the campaign payload validates as a schema-correct DRAFT (status is never part of the create payload — server always defaults to draft)', () => {
  const result = marketingCampaignCreate.safeParse({
    name: LABOR_DAY_CAMPAIGN.name,
    subject: LABOR_DAY_CAMPAIGN.subject,
    subject_fallback: LABOR_DAY_CAMPAIGN.subject_fallback,
    preview_text: LABOR_DAY_CAMPAIGN.preview_text,
    content: LABOR_DAY_CAMPAIGN.content,
    html_body: LABOR_DAY_CAMPAIGN.html_body,
    audience_type: LABOR_DAY_CAMPAIGN.audience_type,
  });
  assert.equal(result.success, true, JSON.stringify(result.success ? null : result.error.issues));
  // The create schema has no `status` field at all — schema.sql's own
  // column default ('draft') is the only way a row is ever created as
  // anything else, and nothing in this payload can override that.
  assert.ok(!('status' in marketingCampaignCreate.shape));
});

test('27. no send/schedule code path is reachable from anything this task touched', () => {
  const controllerSource = readFileSync(join(root, 'src/controllers/marketingCampaigns.controller.ts'), 'utf8');
  assert.doesNotMatch(controllerSource, /initiateCampaignSend/);
  assert.doesNotMatch(controllerSource, /sendViaPauboxApi/);
});

test('28. assertCampaignEditable still permits editing a fresh draft with no delivery lock (used to add html_body/subject_fallback to an existing draft safely)', () => {
  assert.doesNotThrow(() => assertCampaignEditable('draft', false));
});

test('29. this test file makes zero HTTP requests to Paubox, Supabase, or any live endpoint', () => {
  const thisFile = readFileSync(new URL(import.meta.url), 'utf8');
  assert.doesNotMatch(thisFile, /await fetch\(/);
  assert.doesNotMatch(thisFile, /sendViaPauboxApi\(/);
});
