import type { NavItem, NavLink, ServiceSummary } from '@/types/content';
import { summariesByCategory, getServiceSummary } from './service-catalog';
import { telehealthStates } from './telehealth-states';

/** Resolves a service's real href from the catalog by slug — URLs are never duplicated/hardcoded here. */
const hrefFor = (slug: string): string => getServiceSummary(slug)!.href;

/**
 * Services mega menu content (Phase 27 reorg). Deliberately hand-curated
 * labels/descriptions here, distinct from both the real page title/SEO
 * title (untouched) and service-catalog.ts's own CARD_LABEL_OVERRIDES
 * (similar intent, different — shorter — wording for this specific menu).
 * hrefs are always resolved from the catalog by slug via hrefFor(), never
 * duplicated as literal strings, so a route change only needs updating in
 * one place.
 */
const mentalHealthMenuLinks: NavLink[] = [
  {
    label: 'Psychiatric Evaluations',
    href: hrefFor('psychiatric-evaluations'),
    description: 'A thorough first visit and personalized plan',
  },
  {
    label: 'Medication Management',
    href: hrefFor('medication-management'),
    description: 'Ongoing, careful medication adjustments',
  },
  {
    label: 'Conditions We Treat',
    href: '/conditions',
    description: 'Depression, anxiety, ADHD, bipolar disorder, PTSD',
  },
  {
    label: 'Follow-Up Mental Health Care',
    href: hrefFor('psychiatric-follow-up-visits-telehealth'),
    description: 'Regular check-ins to track your progress',
  },
];

/** No description lines, per the brief — keeps this longer column compact. */
const primaryCareMenuLinks: NavLink[] = [
  { label: 'Annual Physicals & Preventive Screenings', href: hrefFor('annual-physical-exam-telehealth') },
  { label: 'Chronic Disease Management', href: hrefFor('chronic-disease-management-telehealth') },
  { label: 'Preventive Care', href: hrefFor('preventive-care-telehealth') },
  { label: 'Sick Visits', href: hrefFor('telehealth-sick-visits-primary-care') },
  { label: 'Weight Management', href: hrefFor('weight-management-telehealth') },
  { label: 'Wellness & Lifestyle Counseling', href: hrefFor('wellness-and-lifestyle-counseling-telehealth') },
  { label: 'Lab Testing Coordination', href: hrefFor('lab-testing-coordination-telehealth') },
];

/** Third Services-menu column — a narrower, tinted column in its own right
 * (not a bottom-strip link), so nursing-student visitors get the same
 * top-level billing as Mental Health/Primary Care. */
const professionalEducationMenuLinks: NavLink[] = [
  { label: 'Preceptorship Program', href: hrefFor('preceptorship-program') },
];

/**
 * Header navigation, mirroring the source site's structure.
 *
 * "Provider" and "Contact" are deliberately short NAVIGATION-LABEL-ONLY
 * simplifications — the bio page's own H1, metadata, SEO title, and
 * credentials content are untouched; this only shortens what the header
 * bar displays. The source site's full title ("Psychiatric Mental Health
 * Nurse Practitioner") and "Contact Us" remain the real page content.
 *
 * Phase 22: no standalone "Home" entry — the logo (in the header and in the
 * mobile drawer, both wrapped in a link to "/") already serves that role on
 * every page, as is standard. Removing the redundant nav entry reclaims
 * real width toward restoring full desktop navigation without overlap; no
 * destination is lost, "/" remains reachable everywhere the logo appears.
 *
 * Phase 24 (homepage reorg) removed "Provider"/"Bio" from here; restored
 * per explicit follow-up request.
 */
export const headerNav: NavItem[] = [
  {
    label: 'Services',
    href: '/our-services',
    groups: [
      { label: 'Mental Health', links: mentalHealthMenuLinks },
      { label: 'Primary Care', links: primaryCareMenuLinks },
      {
        label: 'Professional Education',
        links: professionalEducationMenuLinks,
        caption: 'Clinical training for nurse practitioner students.',
      },
    ],
  },
  { label: 'Provider', href: '/bio' },
  { label: 'Fees & Insurance', href: '/fees-insurance' },
  {
    label: 'Resources',
    href: '/blog',
    flat: [
      { label: 'Blog', href: '/blog' },
      { label: 'Testimonials', href: '/telehealth-mental-health-testimonials' },
      { label: 'Videos', href: '/videos' },
      { label: 'FAQs', href: '/faqs' },
      { label: 'For Providers', href: '/for-providers' },
      { label: 'Partners', href: '/partners' },
    ],
  },
  { label: 'Contact', href: '/contact-telehealth-mental-health-provider' },
];

export const headerCta: NavLink = {
  label: 'Book an Appointment',
  href: '/book-telehealth-mental-health-appointment#charm-calendar',
};

/**
 * Footer-only display label overrides. These exist purely to keep footer
 * link text short/premium — the underlying service slug, title, and route
 * (SEO-relevant everywhere else: header nav, service-page cross-links,
 * page metadata) are completely untouched. `footerLink()` below always
 * takes `href` from the real service data, never a hardcoded route, so a
 * footer label can never drift from its actual destination.
 */
const FOOTER_LABEL_OVERRIDES: Record<string, string> = {
  'treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd': 'Conditions We Treat',
  'telehealth-sick-visits-primary-care': 'Sick Visits',
  'psychiatric-follow-up-visits-telehealth': 'Follow-Up Mental Health Care',
  'wellness-and-lifestyle-counseling-telehealth': 'Wellness & Lifestyle Counseling',
};

const footerLink = (s: ServiceSummary): NavLink => ({
  label: FOOTER_LABEL_OVERRIDES[s.slug] ?? s.title,
  href: s.href,
});

/** Footer "Mental Health" column — same 4 psychiatric services, footer-length labels. */
export const footerMentalHealthLinks: NavLink[] = summariesByCategory('psychiatric').map(footerLink);

/** Footer "Primary Care" column — same 7 primary-care services, footer-length labels. */
export const footerPrimaryCareLinks: NavLink[] = summariesByCategory('primary-care').map(footerLink);

/** Footer "Professional Education" column — currently just Preceptorship Program. */
export const footerProfessionalEducationLinks: NavLink[] = summariesByCategory('professional-education').map(footerLink);

/** Footer "Explore" column — visitor/resource links only; state and legal links live in their own rows below. */
export const footerExploreLinks: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Bio', href: '/bio' },
  { label: 'Orlando Office', href: '/orlando-psychiatric-care' },
  { label: 'Fees & Insurance', href: '/fees-insurance' },
  { label: 'Blog', href: '/blog' },
  { label: 'Testimonials', href: '/telehealth-mental-health-testimonials' },
  { label: 'Videos', href: '/videos' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'For Providers', href: '/for-providers' },
  { label: 'Partners', href: '/partners' },
  { label: 'Conditions We Treat', href: '/conditions' },
  { label: 'ADHD', href: '/conditions/adhd' },
  { label: 'Anxiety', href: '/conditions/anxiety' },
  { label: 'Depression', href: '/conditions/depression' },
  { label: 'Bipolar Disorder', href: '/conditions/bipolar-disorder' },
  { label: 'PTSD', href: '/conditions/ptsd' },
  { label: 'Psychiatric Care Near Avalon Park', href: '/psychiatric-care-avalon-park' },
  { label: 'Contact Us', href: '/contact-telehealth-mental-health-provider' },
];

/** Compact "Telehealth Care" utility row — navigation only, no eligibility claims. */
export const footerTelehealthLinks: NavLink[] = telehealthStates.map((s) => ({
  label: s.name,
  href: `/telehealth/${s.slug}`,
}));

export const footerConditionsLinks: NavLink[] = [
  { label: 'ADHD', href: '/conditions/adhd' },
  { label: 'Anxiety', href: '/conditions/anxiety' },
  { label: 'Depression', href: '/conditions/depression' },
  { label: 'Bipolar Disorder', href: '/conditions/bipolar-disorder' },
  { label: 'PTSD', href: '/conditions/ptsd' },
  { label: 'View all conditions →', href: '/conditions' },
];

export const footerPatientResourceLinks: NavLink[] = [
  { label: 'Fees & Insurance', href: '/fees-insurance' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Blog', href: '/blog' },
  { label: 'Videos', href: '/videos' },
  { label: 'Testimonials', href: '/telehealth-mental-health-testimonials' },
  { label: 'Meet Our Provider', href: '/bio' },
  { label: 'Contact Us', href: '/contact-telehealth-mental-health-provider' },
];

export const footerLocationLinks: NavLink[] = [
  { label: 'Orlando Office', href: '/orlando-psychiatric-care' },
  { label: 'Avalon Park', href: '/psychiatric-care-avalon-park' },
];

export const footerProfessionalLinks: NavLink[] = [
  { label: 'For Providers', href: '/for-providers' },
  { label: 'Partners', href: '/partners' },
  { label: 'Preceptorship Program', href: hrefFor('preceptorship-program') },
];

export const legalLinks: NavLink[] = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms & Conditions', href: '/terms-conditions' },
  { label: 'Accessibility Statement', href: '/accessibility-statement' },
  { label: 'SMS Consent / Communication Policy', href: '/sms-consent-communication-policy' },
];
