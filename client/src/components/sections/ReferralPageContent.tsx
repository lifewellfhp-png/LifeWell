import Link from 'next/link';
import { PageHero } from '@/components/sections/PageHero';
import { Section, Container } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';

const PHONE = '(407) 603-1717';
const FAX = '(407) 710-8252';
const CONTACT_HREF = '/contact-telehealth-mental-health-provider?reason=general_admin';

function NoticeBox() {
  return (
    <div className="rounded-md border border-brand-primary/20 bg-brand-primary-soft p-6 sm:p-8">
      <p className="font-semibold text-text-primary">
        Please don&apos;t send patient information through our website contact form or by regular
        email. Use fax or call our office.
      </p>
      <p className="mt-4 text-text-secondary">
        LifeWell doesn&apos;t provide emergency care. For a mental health crisis, call or text 988,
        or call 911.
      </p>
    </div>
  );
}

export function ForProvidersPageContent() {
  return (
    <>
      <PageHero
        eyebrow="For Providers"
        title="Refer a patient to LifeWell"
        lead="LifeWell provides psychiatric evaluations, medication management, and follow-up care for patients age 12 and older by telehealth in Florida, Massachusetts, and Arizona, with in-person care in Orlando. Primary care is available for adults 18+."
        breadcrumbs={[
          { name: 'Home', href: '/' },
          { name: 'For Providers', href: '/for-providers' },
        ]}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={`tel:${FAX.replace(/\D/g, '')}`}
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-brand-primary-solid px-5 text-center text-sm font-semibold text-white no-underline transition-colors hover:bg-brand-primary-solid/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary-solid"
          >
            Fax a referral: {FAX}
          </a>
          <a
            href={`tel:${PHONE.replace(/\D/g, '')}`}
            className="inline-flex min-h-12 items-center justify-center rounded-sm border border-brand-primary-solid px-5 text-center text-sm font-semibold text-brand-primary-solid no-underline transition-colors hover:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary-solid"
          >
            Call {PHONE}
          </a>
        </div>
      </PageHero>

      <Section tone="base">
        <Container size="prose">
          <section aria-labelledby="how-to-refer">
            <h2 id="how-to-refer">How to refer</h2>
            <ol className="mt-6 grid gap-5 sm:grid-cols-3">
              {[
                `Fax the referral and records to ${FAX}.`,
                'Include the items listed below.',
                'We contact the patient within 1 business day to schedule.',
              ].map((step, index) => (
                <li key={step} className="rounded-md border border-border-subtle bg-surface-raised p-5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-primary-solid font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="mt-4 text-md leading-relaxed text-text-secondary">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-text-secondary">
              Patients can also{' '}
              <Link href="/book-telehealth-mental-health-appointment" className="font-semibold text-text-link underline">
                book directly online
              </Link>{' '}
              or call {PHONE}.
            </p>
          </section>

          <section aria-labelledby="what-to-include" className="mt-16">
            <h2 id="what-to-include">What to include</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                'Referral letter or order',
                'Reason for referral',
                'Recent clinical notes',
                'Current medication list',
                'Relevant diagnoses',
                'Insurance information',
                'Patient contact information',
                "Referring provider's contact details and NPI",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-text-secondary">
                  <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-brand-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="who-we-see" className="mt-16">
            <h2 id="who-we-see">Who we see</h2>
            <p className="mt-4 text-text-secondary">
              LifeWell provides psychiatric care for patients ages 12+ with depression, anxiety,
              ADHD, bipolar disorder, and PTSD. We provide telehealth in Florida, Massachusetts,
              and Arizona, and in-person care in Orlando.{' '}
              <Link href="/fees-insurance" className="font-semibold text-text-link underline">
                See fees and insurance information.
              </Link>
            </p>
          </section>

          <section aria-labelledby="schools" className="mt-16">
            <h2 id="schools">For schools</h2>
            <p className="mt-4 text-text-secondary">
              Schools may refer students with a parent or guardian&apos;s consent. We coordinate
              with the family, and schools should share records only with consent.
            </p>
          </section>

          <section aria-labelledby="coordination" className="mt-16">
            <h2 id="coordination">Coordination of care</h2>
            <p className="mt-4 text-text-secondary">
              With the patient&apos;s permission, we can send visit summaries back to the referring
              provider to support continuity of care.
            </p>
          </section>

          <div className="mt-16">
            <NoticeBox />
          </div>

          <section aria-labelledby="provider-questions" className="mt-16 rounded-md bg-surface-raised p-6 sm:p-8">
            <h2 id="provider-questions" className="text-h4">Provider questions?</h2>
            <p className="mt-3 text-text-secondary">
              Call{' '}
              <a href={`tel:${PHONE.replace(/\D/g, '')}`} className="font-semibold text-text-link underline">
                {PHONE}
              </a>
              . For non-clinical questions, you can also use our{' '}
              <Link href={CONTACT_HREF} className="font-semibold text-text-link underline">
                general contact page
              </Link>
              .
            </p>
          </section>
        </Container>
      </Section>
    </>
  );
}

export function PartnersPageContent() {
  return (
    <>
      <PageHero
        eyebrow="Partners"
        title="Mental health support for your organization."
        lead="LifeWell helps organizations connect people with outpatient psychiatric care by telehealth in Florida, Massachusetts, and Arizona, or in person in Orlando."
        breadcrumbs={[
          { name: 'Home', href: '/' },
          { name: 'Partners', href: '/partners' },
        ]}
      />

      <Section tone="base">
        <Container size="prose">
          <section aria-labelledby="employers">
            <h2 id="employers">For employers</h2>
            <p className="mt-4 text-text-secondary">
              Make it easier for employees to access psychiatric evaluations, medication
              management, and follow-up care through clear referral pathways. We can help your
              organization share accurate information about how to connect with LifeWell and what
              patients should expect.
            </p>
          </section>

          <section aria-labelledby="colleges" className="mt-16">
            <h2 id="colleges">For colleges and universities</h2>
            <p className="mt-4 text-text-secondary">
              Support students seeking outpatient psychiatric care with a straightforward path to
              telehealth or in-person care in Orlando. We can help colleges and universities
              communicate referral options and provide educational talks about accessing mental
              health support.
            </p>
          </section>

          <section aria-labelledby="partnership-approach" className="mt-16">
            <h2 id="partnership-approach">A practical partnership approach</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                'Clear information for employees and students',
                'Simple referral pathways to outpatient care',
                'Education about how to seek support',
              ].map((item) => (
                <li key={item} className="rounded-md border border-border-subtle bg-surface-raised p-5 text-text-secondary">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="partnership-cta" className="mt-16 rounded-md bg-surface-raised p-6 sm:p-8">
            <h2 id="partnership-cta" className="text-h4">Contact us about a partnership</h2>
            <p className="mt-3 text-text-secondary">
              For a general administrative question,{' '}
              <Link href={CONTACT_HREF} className="font-semibold text-text-link underline">
                contact LifeWell
              </Link>{' '}
              or call{' '}
              <a href={`tel:${PHONE.replace(/\D/g, '')}`} className="font-semibold text-text-link underline">
                {PHONE}
              </a>
              .
            </p>
            <div className="mt-6">
              <SwapButton href={CONTACT_HREF}>Contact us about a partnership</SwapButton>
            </div>
          </section>

          <div className="mt-16">
            <NoticeBox />
          </div>
        </Container>
      </Section>
    </>
  );
}
