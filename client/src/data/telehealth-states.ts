import type { Faq } from '@/types/content';

/**
 * States where the provider is authorized to deliver telehealth psychiatric
 * care, confirmed by the practice owner. This is the single source of truth
 * for `areaServed` schema and the /telehealth/[state] pages — do not
 * hardcode state names anywhere else.
 *
 * Florida is the only state with an in-person option (the physical Orlando
 * office). Massachusetts and Arizona are telehealth-only — there is no
 * office, and no physical presence should ever be implied for them.
 */
export interface TelehealthState {
  slug: string;
  code: string;
  name: string;
  inPersonAvailable: boolean;
  metaTitle: string;
  metaDescription: string;
  headingLead: string;
  headingAccent: string;
  intro: string[];
  licensureStatement: string;
  faqs: Faq[];
}

export const telehealthStates: TelehealthState[] = [
  {
    slug: 'florida',
    code: 'FL',
    name: 'Florida',
    inPersonAvailable: true,
    metaTitle: 'Telehealth & In-Person Psychiatric Care in Florida',
    metaDescription:
      'Psychiatric evaluations and medication management for Florida residents — by secure telehealth statewide, or in person at our Orlando office.',
    headingLead: 'Psychiatric Care for',
    headingAccent: 'Florida Residents',
    intro: [
      "Florida residents can see Lourdie Chachoute, FNP-C, PMHNP-BC, either by secure telehealth from anywhere in the state or in person at our Orlando office — whichever fits your schedule and preference.",
      'Both options include the same personalized psychiatric evaluations, medication management, and ongoing follow-up care.',
    ],
    licensureStatement:
      'Lourdie Chachoute, FNP-C, PMHNP-BC, is licensed to provide psychiatric care to patients located in Florida, both by secure telehealth and in person at our Orlando office.',
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
          'No — any Florida resident is welcome to schedule an in-person visit at our Orlando office, or use telehealth if travel isn’t convenient.',
      },
    ],
  },
  {
    slug: 'massachusetts',
    code: 'MA',
    name: 'Massachusetts',
    inPersonAvailable: false,
    metaTitle: 'Telehealth Psychiatric Care in Massachusetts',
    metaDescription:
      'Secure telehealth psychiatric evaluations and medication management for Massachusetts residents, from a licensed psychiatric-mental health nurse practitioner.',
    headingLead: 'Telehealth Psychiatric Care for',
    headingAccent: 'Massachusetts Residents',
    intro: [
      'LifeWell Family Health & Psychiatry provides secure telehealth psychiatric care to patients located in Massachusetts. There is no physical office in Massachusetts — every visit takes place by secure video from wherever you are.',
      'Massachusetts patients receive the same personalized psychiatric evaluations, medication management, and follow-up care offered to every patient, delivered entirely online.',
    ],
    licensureStatement:
      'Lourdie Chachoute, FNP-C, PMHNP-BC, is licensed and authorized to provide telehealth psychiatric care to patients located in Massachusetts.',
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
        question: 'What do I need for a telehealth visit from Massachusetts?',
        answer:
          'A stable internet connection, a computer, tablet, or smartphone, and a private space for your appointment. You’ll need to be physically located in Massachusetts at the time of your visit.',
      },
    ],
  },
  {
    slug: 'arizona',
    code: 'AZ',
    name: 'Arizona',
    inPersonAvailable: false,
    metaTitle: 'Telehealth Psychiatric Care in Arizona',
    metaDescription:
      'Secure telehealth psychiatric evaluations and medication management for Arizona residents, from a licensed psychiatric-mental health nurse practitioner.',
    headingLead: 'Telehealth Psychiatric Care for',
    headingAccent: 'Arizona Residents',
    intro: [
      'LifeWell Family Health & Psychiatry provides secure telehealth psychiatric care to patients located in Arizona. There is no physical office in Arizona — every visit takes place by secure video from wherever you are.',
      'Arizona patients receive the same personalized psychiatric evaluations, medication management, and follow-up care offered to every patient, delivered entirely online.',
    ],
    licensureStatement:
      'Lourdie Chachoute, FNP-C, PMHNP-BC, is licensed and authorized to provide telehealth psychiatric care to patients located in Arizona.',
    faqs: [
      {
        question: 'Is telehealth psychiatric care legal in Arizona?',
        answer:
          'Yes. Telehealth psychiatric care is a recognized, legal way to receive mental health treatment in Arizona when delivered by a provider licensed to treat patients in the state.',
      },
      {
        question: 'Do you have an office in Arizona?',
        answer:
          'No. Care for Arizona residents is provided entirely by telehealth. Our only physical office is in Orlando, Florida.',
      },
      {
        question: 'What do I need for a telehealth visit from Arizona?',
        answer:
          'A stable internet connection, a computer, tablet, or smartphone, and a private space for your appointment. You’ll need to be physically located in Arizona at the time of your visit.',
      },
    ],
  },
];

export const telehealthStateSlugs = telehealthStates.map((s) => s.slug);

export const getTelehealthState = (slug: string): TelehealthState | undefined =>
  telehealthStates.find((s) => s.slug === slug);
