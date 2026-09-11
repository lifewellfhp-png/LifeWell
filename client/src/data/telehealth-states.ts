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
 *
 * `selfPayInitialFee` / `selfPayFollowUpFee` / `pricingCta` (P7-2) are the
 * same kind of fact, not marketing copy: the owner-approved psychiatric
 * self-pay evaluation/follow-up amounts. A CMS row already exists and is
 * published for all three states (confirmed live), and its single
 * `self_pay_fee` column is already null there, silently overriding any
 * value put in this file's now-legacy `selfPayFee`/`selfPayFeeLabel`
 * fields — so these three new fields are deliberately left OUT of
 * mapTelehealthStates()'s CMS mapping, exactly like `inPersonAvailable`,
 * so they always come from this file regardless of CMS state and can
 * never be silently emptied or mistyped through a free-text Admin field.
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
  /** Approved exact self-pay figures (P7-2) — not CMS-editable, see note above. */
  selfPayInitialFee: number | null;
  selfPayFollowUpFee: number | null;
  /** Optional additional decision-support link shown alongside secondaryCta (P7-2) — not CMS-editable. */
  pricingCta: { label: string; href: string } | null;
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
    selfPayInitialFee: null,
    selfPayFollowUpFee: null,
    pricingCta: null,
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
    badge: 'Self-Pay Telehealth for Massachusetts Residents',
    heading: 'Online Psychiatric Care for Massachusetts Residents',
    subheading:
      "We see adult patients throughout Massachusetts entirely by secure video — from the Berkshires to Cape Cod, wherever you're able to connect privately. We don't have a physical office in the state, so every Massachusetts appointment is telehealth.",
    body: [
      "A first visit is a full psychiatric evaluation: we review your current symptoms, health and medication history, and goals for treatment, then talk through a plan together. Follow-up visits are shorter medication-management check-ins — how you're responding, any side effects, and whether adjustments make sense.",
      "You'll need a private space, a stable internet connection, and a computer, tablet, or smartphone with camera and microphone. Because Massachusetts requires the provider treating you to be licensed for the state you're physically in, you'll need to be located in Massachusetts at the time of your appointment.",
      "It helps to have a current medication list and a short summary of what brought you in ready before your visit — we'll ask about both. Telehealth works well for evaluation and medication management, but it isn't the right fit for a psychiatric emergency; see below for what to do if you need help right away.",
    ],
    careMode: 'Telehealth only',
    insuranceMode: 'self_pay_only',
    selfPayEnabled: true,
    selfPayFee: null,
    selfPayFeeLabel: null,
    pricingNote: null,
    selfPayInitialFee: 300,
    selfPayFollowUpFee: 175,
    pricingCta: { label: 'View Fees & Insurance', href: '/fees-insurance' },
    heroImage: null,
    primaryCta: { label: 'Book an Appointment', href: BOOKING_HREF },
    secondaryCta: { label: 'Meet Your Provider', href: '/bio' },
    faqs: [
      {
        question: 'Is telehealth psychiatric care legal in Massachusetts?',
        answer:
          'Yes. Telehealth is a recognized way to receive psychiatric evaluation and medication management in Massachusetts, provided the clinician is licensed to treat patients located in the state — which we are.',
      },
      {
        question: 'Do you have an office in Massachusetts?',
        answer:
          'No. We do not have a physical location in Massachusetts. Every appointment for Massachusetts patients is conducted by secure video; our only physical office is in Orlando, Florida, and it is not available for Massachusetts visits.',
      },
      {
        question: 'What happens at my first (evaluation) visit?',
        answer:
          'We spend the visit reviewing your symptoms, medical and psychiatric history, current medications, and what you\'re hoping to get out of treatment, then discuss a plan. It is general psychiatric evaluation and medication management, not individualized crisis care.',
      },
      {
        question: 'What do follow-up visits look like?',
        answer:
          'Shorter check-ins focused on how a current treatment plan is working — symptoms, side effects, and whether any medication changes are needed. We never adjust a prescription without discussing it with you directly.',
      },
      {
        question: 'Do you accept insurance for Massachusetts patients?',
        answer:
          'Not currently — care for Massachusetts residents is self-pay only. See Fees & Insurance for the current evaluation and follow-up pricing.',
      },
      {
        question: 'What do I need for the appointment, and where do I need to be?',
        answer:
          'A private space, a stable connection, and a computer, tablet, or smartphone with camera and microphone. You need to be physically located in Massachusetts at the time of the visit — that\'s a state licensing requirement, not a preference.',
      },
      {
        question: 'What can\'t telehealth psychiatric care help with?',
        answer:
          'It is not equipped for psychiatric emergencies or situations requiring immediate, in-person intervention. If you are in crisis, call or text 988 (Suicide & Crisis Lifeline) or call 911, or go to your nearest emergency room.',
      },
    ],
    metaTitle: 'Massachusetts Telehealth Psychiatry — Evaluations & Medication Management',
    metaDescription:
      'Self-pay telehealth psychiatric evaluations and medication management for adults in Massachusetts, from a licensed psychiatric-mental health nurse practitioner. No Massachusetts office — video visits only.',
    ogImageUrl: null,
  },
  {
    slug: 'arizona',
    code: 'AZ',
    name: 'Arizona',
    badge: 'Now Scheduling Arizona Telehealth Appointments',
    heading: 'Arizona Telehealth Psychiatry — Evaluations & Medication Management',
    subheading:
      "We provide psychiatric evaluation and ongoing medication management to adults across Arizona by secure video visit. We're not based in Arizona and don't have an in-state office, so telehealth is the only way we see Arizona patients.",
    body: [
      "Your first appointment is a full evaluation — we go through your symptoms, psychiatric and general medical history, current medications, and what you want treatment to accomplish, then build a plan from there. After that, follow-up visits are focused check-ins on how the plan is working and whether it needs adjusting.",
      "Arizona law requires the clinician treating you to be authorized to practice where you're physically located, so you'll need to be in Arizona for each visit — not just an Arizona resident traveling elsewhere that day. Beyond that, all you need is a private, quiet space and a device with a camera, microphone, and stable internet.",
      "Having your current medications and a brief note on what prompted you to reach out ready before the visit speeds things up. Telehealth is well suited to evaluation and medication follow-up, but it can't replace emergency or crisis care — see the FAQ below for what to do if you need help immediately.",
    ],
    careMode: 'Telehealth only',
    insuranceMode: 'self_pay_only',
    selfPayEnabled: true,
    selfPayFee: null,
    selfPayFeeLabel: null,
    pricingNote: null,
    selfPayInitialFee: 325,
    selfPayFollowUpFee: 175,
    pricingCta: { label: 'View Fees & Insurance', href: '/fees-insurance' },
    heroImage: null,
    primaryCta: { label: 'Book an Appointment', href: BOOKING_HREF },
    secondaryCta: { label: 'What to Expect at Your First Visit', href: '/new-patients' },
    faqs: [
      {
        question: 'Can I get psychiatric care by telehealth in Arizona?',
        answer:
          "Yes. Arizona recognizes telehealth as a legitimate way to receive care, as long as the clinician is authorized to treat patients physically located in the state at the time of the visit — which we are.",
      },
      {
        question: 'Is there an Arizona office I can visit in person?',
        answer:
          'No — we do not have a physical location in Arizona. Every Arizona appointment is a video visit. Our only physical office is in Orlando, Florida, and does not serve Arizona patients.',
      },
      {
        question: 'What should I expect from the first appointment?',
        answer:
          "A thorough psychiatric evaluation: your symptoms, history, current medications, and treatment goals, followed by a discussion of options. It's general evaluation and medication management — not a substitute for emergency or individualized crisis care.",
      },
      {
        question: 'What happens at follow-up visits?',
        answer:
          "Shorter, focused visits to review how you're doing on your current plan and whether anything needs to change. Any medication change is always discussed with you first — we don't adjust a prescription without that conversation.",
      },
      {
        question: 'Do you take insurance for patients in Arizona?',
        answer: 'Not at this time — Arizona care is self-pay only. Current evaluation and follow-up pricing is on our Fees & Insurance page.',
      },
      {
        question: 'What is required on my end for the visit to go smoothly?',
        answer:
          'A private space, a device with camera and microphone, and a stable connection. You must be physically located in Arizona for the appointment — that\'s a licensing requirement tied to where you are, not where you live.',
      },
      {
        question: 'What isn\'t telehealth able to help with?',
        answer:
          "It isn't appropriate for a psychiatric emergency or a situation needing immediate, hands-on care. If you're in crisis, call or text 988 (Suicide & Crisis Lifeline), call 911, or go to the nearest emergency room.",
      },
    ],
    metaTitle: 'Arizona Telehealth Psychiatry — Self-Pay Evaluations & Follow-Up Care',
    metaDescription:
      'Psychiatric evaluations and ongoing medication management for adults in Arizona, delivered entirely by secure telehealth video visit. Self-pay only — no Arizona office.',
    ogImageUrl: null,
  },
];

export const telehealthStateSlugs = telehealthStates.map((s) => s.slug);

export const getTelehealthState = (slug: string): TelehealthState | undefined =>
  telehealthStates.find((s) => s.slug === slug);
