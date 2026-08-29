import type { PricingTier, PricingPackage, PsychiatricStatePricing } from '@/types/content';

/**
 * Fees exactly as published on the source /fees-insurance/ page.
 * Commercially sensitive — do not alter without client confirmation.
 */

export const feesIntro = {
  heading: 'Transparent Mental Health Fees and Insurance Plans',
  body: 'Explore our clear and structured mental health fees and insurance options designed to support individuals, couples, families, and teens. We provide transparent pricing and accepted insurance details to help you plan your care with confidence — all while receiving professional support from the comfort of your own home.',
  image: {
    src: '/images/sections/Fees.avif',
    width: 1180,
    height: 990,
    alt: 'Mental health fees and insurance — reviewing care options with a provider',
  },
};

export const feesClosing = {
  headingLead: 'Start Your Mental Wellness',
  headingAccent: 'Journey Today',
  body: 'Getting started is simple. Choose an available appointment time that works for you.',
  cta: 'Book an Appointment',
  image: {
    src: '/images/sections/Mental-Health-Fees-and-Insurance.avif',
    width: 633,
    height: 740,
    alt: 'Mental Health Fees and Insurance',
  },
};

export const selfPay = {
  heading: 'Cash-Pay / Self-Pay Options',
  body: [
    'We offer self-pay options for individuals who do not have insurance coverage or who prefer not to use their insurance benefits. Self-pay allows you to receive confidential, personalized care without insurance requirements or limitations.',
    'Payment is due at the time services are provided. Fees vary depending on the type and duration of the appointment.',
  ],
};

export const psychiatricStatePricing: PsychiatricStatePricing[] = [
  { state: 'Florida', selfPayOnly: false, initialFee: 300, followUpFee: 150 },
  { state: 'Massachusetts', selfPayOnly: true, initialFee: 300, followUpFee: 175 },
  { state: 'Arizona', selfPayOnly: true, initialFee: 325, followUpFee: 175 },
];

export const pricingTiers: PricingTier[] = [
  {
    name: 'Mental Health',
    initialFee: 250,
    initialDuration: '60 minutes',
    followUpFee: 150,
    followUpDuration: '30 minutes',
    includes: [
      'Psychiatric Evaluations',
      'Medication Management',
      'Anxiety Treatment',
      'Depression Treatment',
      'Sleep Health',
    ],
    freeConsult: true,
  },
  {
    name: 'Primary Care',
    initialFee: 125,
    initialDuration: '60 minutes',
    followUpFee: 75,
    followUpDuration: '30 minutes',
    includes: [
      'New Patient Visits',
      'Chronic Disease Management',
      'Acute Care Visits',
      'Medication Refills',
      'Lab Review',
    ],
    freeConsult: true,
  },
  {
    name: 'Weight Management',
    initialFee: 100,
    initialDuration: '60 minutes',
    followUpFee: 75,
    followUpDuration: '30 minutes',
    includes: [
      'Medical Weight Loss',
      'GLP-1 Medication Management',
      'Metabolic Health',
      'Nutrition Support',
      'Weight Loss Follow-Ups',
    ],
    freeConsult: true,
  },
];

export const packagesSection = {
  heading: 'Weight Management Program Packages',
  body: [
    'We offer structured weight management programs designed to provide ongoing medical supervision, personalized treatment planning, and consistent support to help you achieve safe and sustainable weight loss.',
    'These programs include medical evaluation, progress monitoring, and individualized care tailored to your health needs and goals.',
  ],
};

export const pricingPackages: PricingPackage[] = [
  {
    name: '3-Month Weight Management Program',
    priceRange: '$450 – $900',
    description:
      'This program provides focused, short-term support to help you begin your weight loss journey with medical guidance and structured follow-up.',
    includes: [
      'Initial comprehensive weight management consultation',
      '2–4 follow-up visits for monitoring and adjustments',
      'Personalized weight management and metabolic plan',
      'Messaging support (if available) for ongoing guidance',
    ],
  },
  {
    name: '6-Month Weight Management Program',
    priceRange: '$800 – $1,500',
    description:
      'This extended program provides long-term medical supervision, accountability, and ongoing treatment adjustments to support sustainable weight loss and metabolic health.',
    includes: [
      'Initial comprehensive consultation',
      'Regular follow-up visits and progress monitoring',
      'Personalized treatment and lifestyle plan',
      'Medication management when appropriate',
      'Ongoing support and treatment adjustments',
    ],
  },
];

export const additionalInfo = {
  heading: 'Additional Information',
  body: 'We are committed to providing transparent pricing and high-quality care. If you have questions about services or fees, you are welcome to contact me before scheduling your appointment.',
  notes: [
    'We can provide a detailed receipt (superbill) upon request for patients who wish to seek possible out-of-network reimbursement from their insurance provider. Reimbursement eligibility depends on your individual insurance plan.',
    'Accepted payment methods include major credit and debit cards, as well as secure online payment options for your convenience and privacy.',
  ],
};

export const feesFaqs = [
  {
    question: 'What insurance plans do you accept?',
    answer:
      'I accept select insurance plans for mental health services. Coverage may vary depending on your insurance provider and individual policy. Please contact me directly to confirm whether your plan is accepted and to verify your mental health benefits.',
  },
  {
    question: 'Do you offer self-pay options?',
    answer:
      'Yes, I offer self-pay options for individuals who prefer not to use insurance or whose plans are out-of-network. Transparent fees will be discussed before your appointment so you can make an informed and confident decision about your care.',
  },
  {
    question: 'How much does a telehealth therapy session cost?',
    answer:
      'My session fees vary depending on the type of service provided, such as individual therapy, couples therapy, or medication management. I provide detailed fee and insurance information during the scheduling process to ensure full transparency and help you make an informed decision.',
  },
  {
    question: 'Do you provide superbills for out-of-network reimbursement?',
    answer:
      'Yes, upon request, I can provide a superbill for patients seeking out-of-network reimbursement from their insurance provider. Reimbursement eligibility depends on your individual insurance policy.',
  },
];
