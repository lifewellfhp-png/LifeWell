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
    'Compassionate telehealth mental health care by a board-certified PMHNP. Personalized psychiatric evaluation, medication management, and secure virtual appointments.',
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
   * Hours as published on the Contact page.
   *
   * NOTE: the source site also lists a different, narrower schedule on the Bio
   * page (Mon–Thu 18:00–22:00, Fri–Sat 07:00–22:00). The Contact page version
   * is used here because it is the canonical hours location and covers all
   * seven days. Flagged for client confirmation — see README.
   */
  hours: [
    { days: 'Monday – Friday', opens: '08:00', closes: '22:00', display: '8:00 AM – 10:00 PM EST' },
    { days: 'Saturday – Sunday', opens: '07:00', closes: '22:00', display: '7:00 AM – 10:00 PM EST' },
  ],

  /** Machine-readable form for openingHoursSpecification. */
  hoursSpec: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '22:00' },
    { days: ['Saturday', 'Sunday'], opens: '07:00', closes: '22:00' },
  ],

  social: [
    { name: 'Facebook', href: 'https://www.facebook.com/groups/3391671304409221' },
    { name: 'LinkedIn', href: 'https://www.linkedin.com/in/lourdie-chachoute-914327209' },
    {
      name: 'Instagram',
      href: 'https://www.instagram.com/nashb.lue?igsh=MWVicGh3MGh2MXJiMQ%3D%3D&utm_source=qr',
    },
  ],

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

  /** Google Analytics 4 property carried over from the source site. */
  analytics: {
    ga4: process.env.NEXT_PUBLIC_GA4_ID ?? '',
  },
} as const;

export type Site = typeof site;
