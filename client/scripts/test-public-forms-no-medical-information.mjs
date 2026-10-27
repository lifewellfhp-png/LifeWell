/**
 * Public forms must never collect medical or clinical information.
 * This source-structure regression covers the public contact, newsletter,
 * and booking-related surfaces without requiring a browser test harness.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => readFileSync(join(root, file), 'utf8');
const contact = read('src/components/forms/ContactForm.tsx');
const newsletter = read('src/components/forms/NewsletterForm.tsx');
const booking = read('src/components/sections/BookingCalendar.tsx');
const bookingProfiles = read('src/components/sections/BookingProfiles.tsx');
const contactSchema = read('../server/src/validation/schemas.ts');

test('public forms never collect medical information', () => {
  for (const [name, source] of Object.entries({ contact, newsletter, booking, bookingProfiles })) {
    assert.doesNotMatch(source, /<textarea\b|TextAreaField\b/, `${name} must not add a free-text area`);
  }

  assert.doesNotMatch(contact, /name=["'](?:message|comments?|notes|symptoms|medications?)["']/i);
  assert.doesNotMatch(newsletter, /name=["'](?:message|comments?|notes|symptoms|medications?)["']/i);
  const contactSchemaBlock = contactSchema.slice(
    contactSchema.indexOf('export const contactSchema'),
    contactSchema.indexOf('export type ContactInput')
  );
  const contactSchemaObject = contactSchemaBlock.slice(
    contactSchemaBlock.indexOf('.object({'),
    contactSchemaBlock.indexOf('\n  })')
  );
  assert.match(contactSchemaBlock, /export const contactSchema = z\s*\.object\(\{/);
  assert.match(contactSchemaBlock, /\.strict\(\)/);
  assert.doesNotMatch(contactSchemaObject, /^\s*(message|comments?|notes|symptoms|medications?)\s*:/im);
});
