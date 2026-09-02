import type { NavItem, NavLink, ServiceSummary } from '@/types/content';
import { serviceCategories, summariesByCategory } from './service-catalog';
import { telehealthStates } from './telehealth-states';

/**
 * Header navigation, mirroring the source site's structure.
 *
 * "Provider" and "Contact" are deliberately short NAVIGATION-LABEL-ONLY
 * simplifications — the bio page's own H1, metadata, SEO title, and
 * credentials content are untouched; this only shortens what the header
 * bar displays. The source site's full title ("Psychiatric Mental Health
 * Nurse Practitioner") and "Contact Us" remain the real page content.
 */
export const headerNav: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Services',
    href: '/our-services',
    groups: [
      {
        label: serviceCategories.psychiatric.label,
        links: summariesByCategory('psychiatric').map((s) => ({ label: s.title, href: s.href })),
      },
      {
        label: serviceCategories['primary-care'].label,
        links: summariesByCategory('primary-care').map((s) => ({ label: s.title, href: s.href })),
      },
      {
        label: serviceCategories['professional-education'].label,
        links: summariesByCategory('professional-education').map((s) => ({ label: s.title, href: s.href })),
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
  { label: 'Fees & Insurance', href: '/fees-insurance' },
  { label: 'Blog', href: '/blog' },
  { label: 'Testimonials', href: '/telehealth-mental-health-testimonials' },
  { label: 'Videos', href: '/videos' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Contact Us', href: '/contact-telehealth-mental-health-provider' },
];

/** Compact "Telehealth Care" utility row — navigation only, no eligibility claims. */
export const footerTelehealthLinks: NavLink[] = telehealthStates.map((s) => ({
  label: s.name,
  href: `/telehealth/${s.slug}`,
}));

export const legalLinks: NavLink[] = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms & Conditions', href: '/terms-conditions' },
  { label: 'Accessibility Statement', href: '/accessibility-statement' },
  { label: 'SMS Consent / Communication Policy', href: '/sms-consent-communication-policy' },
];
