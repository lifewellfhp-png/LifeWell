import { site } from './site';
import { provider } from './provider';
import { contactPage } from './contact';

/**
 * /orlando-psychiatric-care — canonical local-search landing page for
 * Orlando, FL (Phase 3 of the patient-acquisition engagement).
 *
 * Every fact here is scoped to what is already established elsewhere in
 * this repo, never invented for this page:
 *   - Address/phone/hours: site.ts (single NAP source of truth).
 *   - Map embed: contact.ts's mapSrc (already live on the Contact page —
 *     reused here rather than a second, possibly-drifting copy).
 *   - In-person availability is scoped to the two services whose own
 *     descriptions (service-catalog.ts) explicitly say "in person at our
 *     Orlando office": psychiatric evaluations and medication management.
 *     Primary-care service copy frames itself as a telehealth alternative
 *     TO in-person care, not an in-person Orlando offering, so no
 *     in-person claim is made for primary care here.
 *   - Provider: provider.ts.
 *
 * No parking, accessibility, or arrival-instruction claim is made — none is
 * verified anywhere in this repository.
 */

export const orlandoHero = {
  titleLead: 'Psychiatric Care',
  titleAccent: 'in Orlando, FL',
  lead: `In-person and telehealth psychiatric evaluations and medication management with ${provider.name}, ${provider.credentials}, at our Orlando office.`,
};

export const orlandoOffice = {
  heading: 'Visit Us',
  headingAccent: 'in Orlando',
  body: 'Our only physical office is located in Orlando, Florida. You can schedule an in-person visit here, or see the same provider by secure telehealth if that fits your schedule better.',
  street: `${site.address.street}, ${site.address.suite}`,
  cityLine: `${site.address.city}, ${site.address.state} ${site.address.zip}`,
  phoneDisplay: site.contact.phone,
  phoneHref: site.contact.phoneHref,
  hours: site.hours,
  mapSrc: contactPage.mapSrc,
  directionsHref: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${site.address.street}, ${site.address.suite}, ${site.address.city}, ${site.address.state} ${site.address.zip}`
  )}`,
};

export const orlandoCareOptions = {
  heading: 'In Person or',
  headingAccent: 'Telehealth',
  body: 'Psychiatric evaluations and medication management are available in person at our Orlando office, or by secure telehealth if you are located anywhere in Florida at the time of your visit.',
  services: [
    { title: 'Psychiatric Evaluations', href: '/services/psychiatric-evaluations' },
    { title: 'Medication Management', href: '/services/medication-management' },
  ],
  telehealthHref: '/telehealth/florida',
  telehealthLinkLabel: 'See telehealth details for Florida residents',
};

export const orlandoProviderSection = {
  heading: 'Meet Your',
  headingAccent: 'Provider',
  body: `${provider.name}, ${provider.credentials}, is a dual board-certified nurse practitioner providing psychiatric evaluations, medication management, and ongoing follow-up care at the Orlando office and by telehealth.`,
  href: '/bio',
  linkLabel: "Read Lourdie's full bio",
  image: provider.image,
};

export const orlandoNewPatients = {
  heading: 'New Patients',
  headingAccent: 'Welcome',
  body: 'LifeWell Family Health & Psychiatry is currently accepting new patients. See what to expect at your first appointment, and review payment and coverage options before you schedule.',
  newPatientsHref: '/new-patients',
  newPatientsLabel: 'What to Expect at Your First Visit',
  feesHref: '/fees-insurance',
  feesLabel: 'Fees & Insurance',
};

export const orlandoNextSteps = {
  heading: 'Ready to Get',
  headingAccent: 'Started?',
  body: 'Book an appointment online, call the office directly, or reach out with questions before scheduling.',
};
