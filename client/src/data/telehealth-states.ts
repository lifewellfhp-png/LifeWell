import type { Faq } from '@/types/content';

/**
 * Structural fallback only — used when the CMS has no published row for a
 * given state (see cms-resolve.ts's mapTelehealthStates). The CMS
 * (`telehealth_state_pages` table, managed at Admin → Telehealth States) is
 * the primary source of truth for these three pages; this file exists so
 * the routes still render correctly before the CMS is populated, not as a
 * second copy of the real content to keep in sync by hand.
 *
 * `inPersonAvailable` is intentionally NOT admin-editable — whether a real
 * physical office exists is a safety fact, not marketing copy, so it stays
 * tied to the state code in code (see TelehealthStatePageContent.tsx)
 * rather than a CMS field any admin could accidentally flip for MA/AZ.
 */
export interface TelehealthState {
  slug: string;
  code: string;
  name: string;
  badge: string;
  heading: string;
  subheading: string;
  body: string[];
  careMode: string;
  insuranceMode: 'existing' | 'self_pay_only';
  selfPayEnabled: boolean;
  selfPayFee: number | null;
  selfPayFeeLabel: string | null;
  pricingNote: string | null;
  heroImage: { src: string; alt: string } | null;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  faqs: Faq[];
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string | null;
}

const BOOKING_HREF = '/book-telehealth-mental-health-appointment#charm-calendar';

export const telehealthStates: TelehealthState[] = [
  {
    slug: 'florida',
    code: 'FL',
    name: 'Florida',
    badge: 'Now Accepting New Patients',
    heading: 'Psychiatric Care for Florida Residents',
    subheading:
      "Florida residents can see Lourdie Chachoute, FNP-C, PMHNP-BC, either by secure telehealth from anywhere in the state or in person at our Orlando office — whichever fits your schedule and preference.",
    body: [
      'Both options include the same personalized psychiatric evaluations, medication management, and ongoing follow-up care.',
    ],
    careMode: 'Telehealth + in-person at our Orlando office',
    insuranceMode: 'existing',
    selfPayEnabled: false,
    selfPayFee: null,
    selfPayFeeLabel: null,
    pricingNote: null,
    heroImage: null,
    primaryCta: { label: 'Book an Appointment', href: BOOKING_HREF },
    secondaryCta: { label: 'View Fees & Insurance', href: '/fees-insurance' },
    faqs: [
      {
        question: 'Can I choose between a telehealth visit and an in-person visit?',
        answer:
          'Yes. Florida residents can schedule either a secure telehealth appointment or an in-person visit at our Orlando office, and can switch between the two as your needs change.',
      },
      {
        question: 'Where is your office located?',
        answer: '3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828.',
      },
      {
        question: 'Do I need to live in Orlando to be seen in person?',
        answer:
          'No — any Florida resident is welcome to schedule an in-person visit at our Orlando office, or use telehealth if travel is not convenient.',
      },
    ],
    metaTitle: 'Telehealth & In-Person Psychiatric Care in Florida',
    metaDescription:
      'Psychiatric evaluations and medication management for Florida residents — by secure telehealth statewide, or in person at our Orlando office.',
    ogImageUrl: null,
  },
  {
    slug: 'massachusetts',
    code: 'MA',
    name: 'Massachusetts',
    badge: 'Telehealth Now Available in Massachusetts',
    heading: 'Telehealth Psychiatric Care for Massachusetts Residents',
    subheading:
      'LifeWell Family Health & Psychiatry provides secure telehealth psychiatric care to patients located in Massachusetts. There is no physical office in Massachusetts — every visit takes place by secure video from wherever you are.',
    body: [
      'Massachusetts patients receive the same personalized psychiatric evaluations, medication management, and follow-up care offered to every patient, delivered entirely online. Care in Massachusetts is currently self-pay only.',
    ],
    careMode: 'Telehealth only',
    insuranceMode: 'self_pay_only',
    selfPayEnabled: true,
    selfPayFee: null,
    selfPayFeeLabel: null,
    pricingNote: null,
    heroImage: null,
    primaryCta: { label: 'Book an Appointment', href: BOOKING_HREF },
    secondaryCta: { label: 'Meet Your Provider', href: '/bio' },
    faqs: [
      {
        question: 'Is telehealth psychiatric care legal in Massachusetts?',
        answer:
          'Yes. Telehealth psychiatric care is a recognized, legal way to receive mental health treatment in Massachusetts when delivered by a provider licensed to treat patients in the state.',
      },
      {
        question: 'Do you have an office in Massachusetts?',
        answer:
          'No. Care for Massachusetts residents is provided entirely by telehealth. Our only physical office is in Orlando, Florida.',
      },
      {
        question: 'Do you accept insurance in Massachusetts?',
        answer: 'Care for Massachusetts residents is currently self-pay only. Contact us for current self-pay pricing.',
      },
      {
        question: 'What do I need for a telehealth visit from Massachusetts?',
        answer:
          'A stable internet connection, a computer, tablet, or smartphone, and a private space for your appointment. You will need to be physically located in Massachusetts at the time of your visit.',
      },
    ],
    metaTitle: 'Telehealth Psychiatric Care in Massachusetts',
    metaDescription:
      'Secure, self-pay telehealth psychiatric evaluations and medication management for Massachusetts residents, from a licensed psychiatric-mental health nurse practitioner.',
    ogImageUrl: null,
  },
  {
    slug: 'arizona',
    code: 'AZ',
    name: 'Arizona',
    badge: 'Telehealth Now Available in Arizona',
    heading: 'Telehealth Psychiatric Care for Arizona Residents',
    subheading:
      'LifeWell Family Health & Psychiatry provides secure telehealth psychiatric care to patients located in Arizona. There is no physical office in Arizona — every visit takes place by secure video from wherever you are.',
    body: [
      'Arizona patients receive the same personalized psychiatric evaluations, medication management, and follow-up care offered to every patient, delivered entirely online. Care in Arizona is currently self-pay only.',
    ],
    careMode: 'Telehealth only',
    insuranceMode: 'self_pay_only',
    selfPayEnabled: true,
    selfPayFee: null,
    selfPayFeeLabel: null,
    pricingNote: null,
    heroImage: null,
    primaryCta: { label: 'Book an Appointment', href: BOOKING_HREF },
    secondaryCta: { label: 'Meet Your Provider', href: '/bio' },
    faqs: [
      {
        question: 'Is telehealth psychiatric care legal in Arizona?',
        answer:
          'Yes. Telehealth psychiatric care is a recognized, legal way to receive mental health treatment in Arizona when delivered by a provider licensed to treat patients in the state.',
      },
      {
        question: 'Do you have an office in Arizona?',
        answer: 'No. Care for Arizona residents is provided entirely by telehealth. Our only physical office is in Orlando, Florida.',
      },
      {
        question: 'Do you accept insurance in Arizona?',
        answer: 'Care for Arizona residents is currently self-pay only. Contact us for current self-pay pricing.',
      },
      {
        question: 'What do I need for a telehealth visit from Arizona?',
        answer:
          'A stable internet connection, a computer, tablet, or smartphone, and a private space for your appointment. You will need to be physically located in Arizona at the time of your visit.',
      },
    ],
    metaTitle: 'Telehealth Psychiatric Care in Arizona',
    metaDescription:
      'Secure, self-pay telehealth psychiatric evaluations and medication management for Arizona residents, from a licensed psychiatric-mental health nurse practitioner.',
    ogImageUrl: null,
  },
];

export const telehealthStateSlugs = telehealthStates.map((s) => s.slug);

export const getTelehealthState = (slug: string): TelehealthState | undefined =>
  telehealthStates.find((s) => s.slug === slug);
