/**
 * Copy and imagery from the live /contact-telehealth-mental-health-provider/ page
 * (Elementor post 50990).
 */
export const contactPage = {
  headingLead: 'Contact Telehealth Mental Health Provider',
  headingAccent: 'for Secure, Confidential Support',
  lead: 'Reach out today to contact a telehealth mental health provider, schedule your appointment, or ask questions about services, fees, and insurance options.',
  phoneDisplay: '(407) 603 - 1717',
  infoHeading: 'Contact',
  infoAccent: 'Information',
  infoBody:
    'We’re here to support you on your mental wellness journey. Whether you have questions about our services, would like to schedule an appointment, or need additional information, compassionate and confidential assistance is available to help you move forward with confidence.',
  hours: [
    'Monday–Friday | 08:00 AM–10:00 PM EST',
    'Saturday–Sunday | 07:00 AM–10:00 PM EST',
  ],
  formHeading: 'Ask a',
  formAccent: 'Question',
  formBody:
    'Have a question or need more information? Fill out the form below, and you will receive a confidential response shortly.',
  heroImage: {
    src: '/images/sections/Contact-Information.avif',
    width: 1180,
    height: 990,
    alt: 'Contact a telehealth mental health provider',
  },
  formImage: {
    src: '/images/sections/Contact-Telehealth-Mental-Health-Provider.avif',
    width: 633,
    height: 740,
    alt: 'Contact Telehealth Mental Health Provider',
  },
  mapSrc:
    'https://maps.google.com/maps?q=3680+Avalon+Park+E+Blvd+Suite+310,+Orlando,+FL+32828&z=15&output=embed',
};

/**
 * P4-B4: the public Contact form is an administrative/non-clinical request
 * only — no free-text Subject or Message. This is the client-side mirror of
 * the server's allowlist (server/src/validation/schemas.ts); the two are
 * kept in sync by hand since client/server share no code in this repo. The
 * server independently validates against its own copy — this list is for
 * rendering the dropdown only and is never trusted as-is.
 */
export const CONTACT_REASONS = [
  { value: 'scheduling', label: 'Schedule an appointment' },
  { value: 'insurance_pricing', label: 'Insurance or pricing question' },
  { value: 'existing_appointment', label: 'Existing appointment question' },
  { value: 'billing_admin', label: 'Billing or administrative question' },
  { value: 'general_admin', label: 'General administrative question' },
] as const;

export type ContactReason = (typeof CONTACT_REASONS)[number]['value'];
