/**
 * Regression tests for the pre-launch landing-page accuracy audit (6
 * issues). Covers the parts resolved via code: Issue 1 (universal
 * telehealth-only wording), Issue 2 (developer note on booking page),
 * Issue 3 (duplicate subheading/H2 text on service pages), Issue 4
 * (unverified couples/family/teen service claim on the fees page), and
 * Issue 6 (removal of the three unapproved social links). Issue 5
 * (office-hours conflict) is partially resolved — the owner-confirmed
 * Sunday closure is implemented without asserting any still-disputed
 * weekday/Saturday value; those remain an unresolved business fact, not a
 * testable assertion — see the audit report, not this file.
 *
 * No network calls, no CMS, no Production data — these only prove the
 * *static fallback* is fixed. The live CMS rows for benefits/how_it_works
 * (Issue 1), the medication-management service body (Issue 3), and the
 * locations table's hours (Issue 5) are separate, documented
 * pending-owner-confirmation items; this file cannot assert on live CMS
 * content without a network call.
 *
 *   npx tsx --test scripts/test-prelaunch-accuracy-audit.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { benefits, steps } from '../src/data/marketing.ts';
import { feesIntro } from '../src/data/pricing.ts';
import { site } from '../src/data/site.ts';
import { contactPage } from '../src/data/contact.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const bookingSource = readFileSync(join(root, 'src/components/sections/BookingCalendar.tsx'), 'utf8');
const servicePageSource = readFileSync(join(root, 'src/components/sections/ServicePageContent.tsx'), 'utf8');
const generatedServicesSource = readFileSync(join(root, 'src/data/generated/services.ts'), 'utf8');

/* ------------------------------------------------- Issue 1: telehealth-only wording --- */

test('1. the "Private & Secure Telehealth Sessions" benefit no longer claims ALL appointments are telehealth', () => {
  const item = benefits.find((b) => b.title === 'Private & Secure Telehealth Sessions');
  assert.ok(item, 'expected the telehealth-sessions benefit to still exist');
  assert.doesNotMatch(item.description, /^All appointments are conducted/);
  assert.match(item.description, /in-person/i);
});

test('2. the "How It Works" step 2 no longer claims the session is universally virtual', () => {
  const step2 = steps[1];
  assert.ok(step2);
  assert.notEqual(step2.title, 'Attend Your Virtual Session');
  assert.doesNotMatch(step2.description, /through a secure telehealth platform, allowing you to receive care from the comfort/);
});

test('3. no occurrence of the universal telehealth-only phrasing remains in generated service content', () => {
  assert.doesNotMatch(generatedServicesSource, /All psychiatric evaluations are conducted through our telehealth platform/);
  assert.doesNotMatch(generatedServicesSource, /All medication management appointments are conducted through our telehealth platform/);
});

test('4. the legitimately-scoped FAQ answer about telehealth-session confidentiality is untouched (it answers a telehealth-specific question, not a universal claim)', () => {
  // This is a deliberate non-regression check: a prior, broader find-and-
  // replace temptation could have swept this up too. The question itself
  // ("Are telehealth sessions confidential?") scopes the answer correctly,
  // so it must still exist verbatim.
  const marketingSource = readFileSync(join(root, 'src/data/marketing.ts'), 'utf8');
  assert.match(marketingSource, /Are telehealth sessions confidential\?/);
  assert.match(marketingSource, /Yes\. All telehealth sessions are conducted through our telehealth platform/);
});

/* --------------------------------------------------- Issue 2: developer note --- */

test('5. the booking page no longer exposes the "previous LifeWell site" developer note', () => {
  assert.doesNotMatch(bookingSource, /previous LifeWell site/);
  assert.doesNotMatch(bookingSource, /same CharmHealth calendar used on/);
});

test('6. the booking page still has real, patient-facing copy in that spot (the fix did not blank the section)', () => {
  assert.match(bookingSource, /Select an available date and time below to book your secure telehealth visit\./);
});

/* ----------------------------------------------- Issue 3: duplicate heading --- */

test('7. the service-page article H2 uses a distinct heading, never re-rendering the hero subheading verbatim', () => {
  assert.doesNotMatch(servicePageSource, /\{lead \|\| title\}/);
  assert.match(servicePageSource, /const articleHeading = service\?\.lead \|\| title;/);
  // Confirm the H2 actually renders the new variable, not the old one.
  const h2Idx = servicePageSource.indexOf('<h2 className="font-heading text-[28px]');
  const h2Block = servicePageSource.slice(h2Idx, h2Idx + 200);
  assert.match(h2Block, /\{articleHeading\}/);
});

test('8. the hero subheading (lead) and the article heading are sourced from different fields, so they can never be forced to match by construction', () => {
  const leadLine = servicePageSource.match(/const lead = ([^;]+);/)?.[1];
  const headingLine = servicePageSource.match(/const articleHeading = ([^;]+);/)?.[1];
  assert.ok(leadLine && headingLine);
  assert.notEqual(leadLine.trim(), headingLine.trim());
});

/* --------------------------------- Issue 4: fees page couples/families/teens --- */

test('9. the fees-page intro no longer claims couples, family, or teen services', () => {
  assert.doesNotMatch(feesIntro.body, /couples/i);
  assert.doesNotMatch(feesIntro.body, /famil/i);
  assert.doesNotMatch(feesIntro.body, /teens?\b/i);
});

test('10. the fees-page intro states the verified adult scope instead, without inventing a new restriction wording not already used elsewhere in the codebase', () => {
  assert.match(feesIntro.body, /adults age 18 and older/);
});

/* --------------------------------- Issue 5: confirmed office + telehealth hours --- */

test('11. physical office hours (site.hours) match the owner-confirmed schedule exactly: closed Monday, Tuesday–Friday 10–4, closed Saturday and Sunday', () => {
  const byDay = Object.fromEntries(site.hours.map((h) => [h.days, h]));
  assert.equal(byDay['Monday'].display, 'Closed');
  assert.equal(byDay['Tuesday – Friday'].opens, '10:00');
  assert.equal(byDay['Tuesday – Friday'].closes, '16:00');
  assert.equal(byDay['Saturday'].display, 'Closed');
  assert.equal(byDay['Sunday'].display, 'Closed');
});

test('12. telehealth hours (site.telehealthHours) are a genuinely separate field from physical office hours, matching the owner-confirmed schedule exactly', () => {
  const byDay = Object.fromEntries(site.telehealthHours.map((h) => [h.days, h]));
  assert.equal(byDay['Monday – Thursday'].opens, '18:30');
  assert.equal(byDay['Monday – Thursday'].closes, '20:30');
  assert.equal(byDay['Friday'].opens, '10:00');
  assert.equal(byDay['Friday'].closes, '17:00');
  assert.equal(byDay['Saturday'].opens, '10:00');
  assert.equal(byDay['Saturday'].closes, '17:00');
  assert.equal(byDay['Sunday'].display, 'Closed');
});

test('13. hoursSpec (the JSON-LD openingHoursSpecification source) contains ONLY the physical Tuesday–Friday 10–4 window — no Monday/Saturday/Sunday, and no telehealth time, ever appears here', () => {
  assert.equal(site.hoursSpec.length, 1);
  assert.deepEqual(site.hoursSpec[0].days, ['Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  assert.equal(site.hoursSpec[0].opens, '10:00');
  assert.equal(site.hoursSpec[0].closes, '16:00');
  // Structural guarantee: telehealth's own open/close values must never
  // appear inside hoursSpec, which schema.ts feeds directly into the
  // physical MedicalClinic's openingHoursSpecification.
  const specJson = JSON.stringify(site.hoursSpec);
  assert.doesNotMatch(specJson, /18:30|20:30/);
});

test('14. the Contact page\'s static hours fallback (physical office) matches the confirmed schedule', () => {
  assert.deepEqual(contactPage.hours, [
    'Monday | Closed',
    'Tuesday–Friday | 10:00 AM–4:00 PM EST',
    'Saturday | Closed',
    'Sunday | Closed',
  ]);
});

test('15. the Contact page\'s telehealth-hours fallback is a separate field, matching the confirmed telehealth schedule', () => {
  assert.deepEqual(contactPage.telehealthHours, [
    'Monday–Thursday | 6:30 PM–8:30 PM EST',
    'Friday | 10:00 AM–5:00 PM EST',
    'Saturday | 10:00 AM–5:00 PM EST',
    'Sunday | Closed',
  ]);
});

test('16. the Contact page UI renders both hours blocks under clearly distinct labels, never a shared/ambiguous "Open:" heading', () => {
  const contactContentSource = readFileSync(
    join(root, 'src/components/sections/ContactPageContent.tsx'),
    'utf8'
  );
  assert.match(contactContentSource, /Office Hours \(Orlando\):/);
  assert.match(contactContentSource, /Telehealth Appointment Hours:/);
  assert.doesNotMatch(contactContentSource, />Open:</);
  // The telehealth block must read from contactPage.telehealthHours, never
  // reuse the physical-office `hours` variable.
  const telehealthBlockIdx = contactContentSource.indexOf('Telehealth Appointment Hours:');
  const telehealthBlock = contactContentSource.slice(telehealthBlockIdx, telehealthBlockIdx + 300);
  assert.match(telehealthBlock, /contactPage\.telehealthHours\.map/);
});

test("17. provider.ts's 'Working Shifts' schedule was removed — once both real schedules were confirmed, it was verifiably wrong (matched neither), not merely unconfirmed, and was never required for booking to function", () => {
  const providerSource = readFileSync(join(root, 'src/data/provider.ts'), 'utf8');
  assert.doesNotMatch(providerSource, /shifts: \[/);
  assert.doesNotMatch(providerSource, /'07:00-22:00'/);
  // The component built solely to render it is gone too, not left orphaned.
  assert.throws(() => readFileSync(join(root, 'src/components/ui/TrackedBookingLink.tsx'), 'utf8'), /ENOENT/);
});

/* --------------------------------------------- Issue 6: social links --- */

test('18. the three unapproved social links (Facebook Group, personal LinkedIn, mismatched Instagram) are gone, and none were replaced with a guessed URL', () => {
  assert.equal(site.social.length, 0);
});

test('19. the organization JSON-LD omits sameAs entirely when there are no confirmed profiles, rather than emitting an empty array', () => {
  const schemaSource = readFileSync(join(root, 'src/lib/schema.ts'), 'utf8');
  assert.match(schemaSource, /\.\.\.\(site\.social\.length > 0 \? \{ sameAs: site\.social\.map/);
});

test('20. the Footer and Bio page both guard the social-icon list behind a length check, so an empty array renders no stray empty <ul> rather than a broken-looking icon row', () => {
  const footerSource = readFileSync(join(root, 'src/components/layout/Footer.tsx'), 'utf8');
  const bioSource = readFileSync(join(root, 'src/components/sections/BioPageContent.tsx'), 'utf8');
  assert.match(footerSource, /\{site\.social\.length > 0 && \(/);
  assert.match(bioSource, /\{site\.social\.length > 0 && \(/);
});
