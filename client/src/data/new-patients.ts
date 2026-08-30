/**
 * /new-patients — static page copy (no CMS body-content record exists for
 * this page yet; see cms-resolve.ts's `site_sections` pattern if an
 * admin-editable version is ever wanted). Every fact here is scoped to what
 * P3-E3B5 confirmed as approved: FL/MA/AZ psychiatric telehealth, one
 * physical office in Orlando, no promised intake forms/records/prescriptions.
 */

export const newPatientsHero = {
  titleLead: 'What to Expect',
  titleAccent: 'at Your First Visit',
  lead: "Starting care with LifeWell is straightforward. Here's what to know before your first appointment — whether you're joining us by telehealth or in person in Orlando.",
};

export const beforeYourVisit = {
  heading: 'Before ',
  headingAccent: 'Your Visit',
  body: "A little preparation helps your first appointment go smoothly. It's helpful to have the following ready:",
  items: [
    'A valid photo ID',
    'Insurance information, if applicable',
    'A current list of any medications you take',
    'Questions or concerns you would like to discuss',
  ],
};

export const whatToExpect = {
  heading: 'What to ',
  headingAccent: 'Expect',
  body: [
    "Your first visit is a chance to talk through what's bringing you in, share relevant history, and describe your current symptoms and goals for care.",
    "If medications are part of your history, we'll review them together as part of building a plan that fits your needs. Every plan is personalized — there's no one-size-fits-all approach to care.",
  ],
};

export const telehealthSection = {
  heading: 'Telehealth ',
  headingAccent: 'Visits',
  body: 'Psychiatric telehealth appointments are available for patients located in Florida, Massachusetts, and Arizona at the time of their visit. All you need is a private space, a reliable internet connection, and a device with video and audio.',
  states: [
    { name: 'Florida', href: '/telehealth/florida' },
    { name: 'Massachusetts', href: '/telehealth/massachusetts' },
    { name: 'Arizona', href: '/telehealth/arizona' },
  ],
};

export const inPersonSection = {
  heading: 'In-Person ',
  headingAccent: 'Visits',
  body: "In-person visits are available at LifeWell's Orlando office.",
  address: {
    street: '3680 Avalon Park E Blvd, Suite 310',
    cityLine: 'Orlando, FL 32828',
  },
};

export const insuranceSection = {
  heading: 'Insurance & ',
  headingAccent: 'Self-Pay',
  body: 'Review insurance and self-pay information before your visit.',
};

export const questionsSection = {
  heading: 'Questions ',
  headingAccent: 'Before Your Visit',
  body: "If you still have questions, our FAQs cover the most common ones — or reach out directly and we'll help.",
};
