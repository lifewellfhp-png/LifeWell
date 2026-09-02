import type { NavItem, NavLink } from '@/types/content';
import { serviceCategories, summariesByCategory } from './service-catalog';

/**
 * Header navigation, mirroring the source site's structure.
 *
 * The source labelled the bio link "Psychiatric Mental Health Nurse
 * Practitioner". That full title is used in the header, matching the live site.
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
  { label: 'Psychiatric Mental Health Nurse Practitioner', href: '/bio' },
  { label: 'Fees & Insurance', href: '/fees-insurance' },
  { label: 'Blog', href: '/blog' },
  { label: 'Testimonials', href: '/telehealth-mental-health-testimonials' },
  { label: 'Videos', href: '/videos' },
  { label: 'Contact Us', href: '/contact-telehealth-mental-health-provider' },
];

export const headerCta: NavLink = {
  label: 'Book an Appointment',
  href: '/book-telehealth-mental-health-appointment#charm-calendar',
};

/** Footer columns, matching the source site's four-column layout. */
export const footerColumns: { heading: string; links: NavLink[] }[] = [
  {
    heading: 'Psychiatric & Mental Health Services',
    links: summariesByCategory('psychiatric').map((s) => ({ label: s.title, href: s.href })),
  },
  {
    heading: 'Primary Care Services',
    links: summariesByCategory('primary-care').map((s) => ({ label: s.title, href: s.href })),
  },
  {
    heading: serviceCategories['professional-education'].label,
    links: summariesByCategory('professional-education').map((s) => ({ label: s.title, href: s.href })),
  },
  {
    heading: 'Important Links',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Bio', href: '/bio' },
      { label: 'Fees & Insurance', href: '/fees-insurance' },
      { label: 'Telehealth in Florida', href: '/telehealth/florida' },
      { label: 'Telehealth in Massachusetts', href: '/telehealth/massachusetts' },
      { label: 'Telehealth in Arizona', href: '/telehealth/arizona' },
      { label: 'Blog', href: '/blog' },
      { label: 'Testimonials', href: '/telehealth-mental-health-testimonials' },
      { label: 'Videos', href: '/videos' },
      { label: 'FAQs', href: '/faqs' },
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms & Conditions', href: '/terms-conditions' },
      { label: 'Accessibility Statement', href: '/accessibility-statement' },
      { label: 'SMS Consent / Communication Policy', href: '/sms-consent-communication-policy' },
      { label: 'Contact Us', href: '/contact-telehealth-mental-health-provider' },
    ],
  },
];

export const legalLinks: NavLink[] = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms & Conditions', href: '/terms-conditions' },
  { label: 'Accessibility Statement', href: '/accessibility-statement' },
  { label: 'SMS Consent / Communication Policy', href: '/sms-consent-communication-policy' },
];
