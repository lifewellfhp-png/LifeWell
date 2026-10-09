/**
 * Single source of truth for business identity, contact details and hours.
 * Every component, metadata helper and JSON-LD builder reads from here so the
 * NAP can never drift between pages (the original site published two
 * conflicting sets of office hours).
 */

export const site = {
  name: 'LifeWell Family Health & Psychiatry',
  shortName: 'LifeWell FHP',
  legalName: 'LifeWell Family Health & Psychiatry',
  tagline: 'Compassionate telehealth mental health care',
  description:
    'Compassionate mental health & primary care from a board-certified nurse practitioner. Telehealth in FL, MA & AZ, or in-person in Orlando.',
  footerBlurb:
    'LifeWell Family Health & Psychiatry provides compassionate, secure telehealth mental health care tailored to your individual needs.',

  /** Production origin. Override with NEXT_PUBLIC_SITE_URL at build time. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.lifewellfhp.com',
  locale: 'en_US',
  language: 'en-US',

  contact: {
    phone: '(407) 603-1717',
    phoneHref: 'tel:+14076031717',
    sms: '(407) 603-1717',
    smsHref: 'sms:+14076031717',
    fax: '(407) 710-8252',
    email: 'contact@lifewellfhp.com',
    emailHref: 'mailto:contact@lifewellfhp.com',
  },

  address: {
    street: '3680 Avalon Park E Blvd',
    suite: 'Suite 310',
    city: 'Orlando',
    state: 'FL',
    regionName: 'Florida',
    zip: '32828',
    country: 'US',
    full: '3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828',
  },

  /**
   * Physical Orlando office hours — owner-confirmed (pre-launch accuracy
   * audit). This is the PHYSICAL location's schedule only; see
   * `telehealthHours` below for the separate, later-confirmed telehealth
   * appointment schedule. Do not merge the two — they are genuinely
   * different hours for different things, and conflating them was exactly
   * the accuracy defect this audit exists to fix.
   */
  hours: [
    { days: 'Monday', opens: null, closes: null, display: 'Closed' },
    { days: 'Tuesday – Friday', opens: '10:00', closes: '16:00', display: '10:00 AM – 4:00 PM EST' },
    { days: 'Saturday', opens: null, closes: null, display: 'Closed' },
    { days: 'Sunday', opens: null, closes: null, display: 'Closed' },
  ],

  /**
   * Machine-readable physical-office form for openingHoursSpecification.
   * Monday/Saturday/Sunday are omitted entirely (schema.org convention for
   * "closed") rather than given a fabricated open/close time. Telehealth
   * hours must never appear here — this field describes the physical
   * MedicalClinic location only.
   */
  hoursSpec: [{ days: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '16:00' }],

  /**
   * Telehealth appointment hours — owner-confirmed (pre-launch accuracy
   * audit), genuinely separate from the physical office hours above. Any
   * UI that renders this must label it clearly as telehealth/virtual
   * appointment availability, never as "office hours".
   */
  telehealthHours: [
    { days: 'Monday – Thursday', opens: '18:30', closes: '20:30', display: '6:30 PM – 8:30 PM EST' },
    { days: 'Friday', opens: '10:00', closes: '17:00', display: '10:00 AM – 5:00 PM EST' },
    { days: 'Saturday', opens: '10:00', closes: '17:00', display: '10:00 AM – 5:00 PM EST' },
    { days: 'Sunday', opens: null, closes: null, display: 'Closed' },
  ],

  /**
   * All three previously-listed destinations were removed per owner
   * decision (pre-launch accuracy audit): the Facebook link pointed to a
   * Group rather than an official Page, the LinkedIn link was a personal
   * profile, and the Instagram handle did not match the practice's brand.
   * None were replaced with a guessed URL — add real official profiles
   * here once confirmed. Every consumer (Footer, Bio page, JSON-LD
   * `sameAs`) renders nothing when this is empty rather than showing a
   * broken/empty icon.
   */
  social: [] as { name: string; href: string }[],

  /**
   * Booking.
   *
   * CharmHealth public calendar is embedded on the in-site booking page.
   * CTAs stay on-site (`page`); the EHR calendar URL is the iframe source.
   */
  booking: {
    url: 'https://ehr.charmtracker.com/publicCal.sas?method=getCal&digest=26a1a06adbd537c481b1d04dd4f7172a298949fe2840a1731b54d620355c17e76ee57013c1a537e61871e728dd80f5a6c2fe0580a6189219',
    page: '/book-telehealth-mental-health-appointment#charm-calendar',
    label: 'Book an Appointment',
    /** Retained for reference; not linked from the UI. */
    alternateSystem: 'https://lourdie-chachoute.clientsecure.me',
  },

  crisis: {
    heading: 'Are You in Danger?',
    body: 'Please call 988 or use this service to get immediate help.',
    lineName: '988 Suicide & Crisis Lifeline',
    phone: '988',
    phoneHref: 'tel:988',
    href: 'https://988lifeline.org/',
  },
} as const;

export type Site = typeof site;
