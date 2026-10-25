import Link from 'next/link';

import { PageHero } from '@/components/sections/PageHero';
import { SwapButton } from '@/components/ui/SwapButton';
import { CONDITION_PAGES, type ConditionPage } from '@/data/condition-pages';
import { site } from '@/data/site';

function CrisisNotice({ condition }: { condition: ConditionPage }) {
  if (condition.slug !== 'bipolar-disorder' && condition.slug !== 'ptsd') return null;
  return (
    <div className="mt-10 rounded-md border border-brand-primary/20 bg-brand-primary-soft p-6">
      <p className="font-semibold text-text-primary">
        If you&apos;re in crisis, call or text 988, or call 911. LifeWell provides outpatient care
        and does not provide emergency services.
      </p>
    </div>
  );
}

export function ConditionPageContent({ condition }: { condition: ConditionPage }) {
  return (
    <>
      <PageHero
        eyebrow="Conditions We Treat"
        title={`${condition.name} treatment in Orlando and by telehealth`}
        lead={condition.summary}
        breadcrumbs={[
          { name: 'Home', href: '/' },
          { name: 'Conditions', href: '/conditions' },
          { name: condition.name, href: `/conditions/${condition.slug}` },
        ]}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <SwapButton href={site.booking.page} trackAs="booking_click">
            Book an Appointment
          </SwapButton>
          <a
            href={site.contact.phoneHref}
            className="inline-flex min-h-12 items-center justify-center rounded-sm border border-brand-primary-solid px-5 text-center text-sm font-semibold text-brand-primary-solid no-underline hover:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary-solid"
          >
            Call {site.contact.phone}
          </a>
        </div>
      </PageHero>

      <main className="bg-white px-5 py-14 sm:px-[30px] sm:py-20 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <section aria-labelledby="what-it-is">
            <h2 id="what-it-is">What it is</h2>
            <p className="mt-4 leading-8 text-text-secondary">{condition.whatItIs}</p>
          </section>

          <section aria-labelledby="common-signs" className="mt-14">
            <h2 id="common-signs">Common signs</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {condition.signs.map((sign) => (
                <li key={sign} className="flex gap-3 text-text-secondary">
                  <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-brand-accent" />
                  <span>{sign}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="how-we-help" className="mt-14">
            <h2 id="how-we-help">How we help</h2>
            <p className="mt-4 leading-8 text-text-secondary">
              LifeWell provides psychiatric evaluation, medication management when appropriate,
              and follow-up care for patients age 12 and older. With your permission, we can
              coordinate with your therapist or counselor. Care is available by telehealth in
              Florida, Massachusetts, and Arizona, or in person in Orlando.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              {condition.serviceLinks.map((link) => (
                <Link key={link.href} href={link.href} className="font-semibold text-text-link underline">
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="first-visit" className="mt-14">
            <h2 id="first-visit">What to expect at the first visit</h2>
            <p className="mt-4 leading-8 text-text-secondary">{condition.firstVisit}</p>
          </section>

          <section aria-labelledby="who-we-see" className="mt-14">
            <h2 id="who-we-see">Who we see</h2>
            <p className="mt-4 leading-8 text-text-secondary">
              LifeWell provides psychiatric care for patients age 12 and older. Telehealth is
              available when you are located in Florida, Massachusetts, or Arizona at the time of
              your visit. In-person care is available in Orlando.
            </p>
          </section>

          <section aria-labelledby="insurance-cost" className="mt-14">
            <h2 id="insurance-cost">Insurance &amp; cost</h2>
            <p className="mt-4 leading-8 text-text-secondary">
              Fees, insurance information, and payment details are available on our{' '}
              <Link href="/fees-insurance" className="font-semibold text-text-link underline">
                fees and insurance page
              </Link>
              .
            </p>
          </section>

          <CrisisNotice condition={condition} />

          <section aria-labelledby="frequently-asked-questions" className="mt-14">
            <h2 id="frequently-asked-questions">Frequently asked questions</h2>
            <div className="mt-6 space-y-6">
              {condition.faqs.map((faq) => (
                <div key={faq.question}>
                  <h3 className="text-lg font-semibold text-text-primary">{faq.question}</h3>
                  <p className="mt-2 leading-7 text-text-secondary">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="other-conditions" className="mt-14">
            <h2 id="other-conditions">Explore other conditions</h2>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              {CONDITION_PAGES.filter((item) => item.slug !== condition.slug).map((item) => (
                <Link key={item.slug} href={`/conditions/${item.slug}`} className="font-semibold text-text-link underline">
                  {item.name}
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="sources" className="mt-14 border-t border-border-subtle pt-8">
            <h2 id="sources" className="text-h4">Sources</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-text-secondary">
              {condition.sources.map((source) => (
                <li key={source.href}>
                  <a href={source.href} target="_blank" rel="noopener noreferrer" className="text-text-link underline">
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}

export function ConditionsIndexContent() {
  return (
    <>
      <PageHero
        eyebrow="Conditions We Treat"
        title="Psychiatric care for the conditions affecting daily life"
        lead="Explore plain-language information about conditions LifeWell evaluates and treats for patients age 12 and older in Orlando and by telehealth."
        breadcrumbs={[
          { name: 'Home', href: '/' },
          { name: 'Conditions', href: '/conditions' },
        ]}
      />
      <section className="bg-white px-5 py-14 sm:px-[30px] sm:py-20 lg:px-10 lg:py-24">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CONDITION_PAGES.map((condition) => (
            <Link
              key={condition.slug}
              href={`/conditions/${condition.slug}`}
              className="rounded-md border border-border-subtle bg-surface-raised p-6 no-underline transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary-solid"
            >
              <h2 className="text-h4 text-text-primary">{condition.name}</h2>
              <p className="mt-3 text-text-secondary">{condition.summary}</p>
              <span className="mt-5 inline-block font-semibold text-text-link underline">Learn more</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
