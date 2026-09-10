import Link from 'next/link';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { JourneyCta } from '@/components/sections/JourneyCta';
import { ServicesGrid } from '@/components/sections/ServicesGrid';
import { serviceSummaries } from '@/data/service-catalog';

/** Live /our-services listing order (page 1 then remaining cards). */
const LIVE_ORDER = [
  'psychiatric-evaluations',
  'medication-management',
  'treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd',
  'preceptorship-program',
  'psychiatric-follow-up-visits-telehealth',
  'lab-testing-coordination-telehealth',
  'wellness-and-lifestyle-counseling-telehealth',
  'weight-management-telehealth',
  'telehealth-sick-visits-primary-care',
  'preventive-care-telehealth',
  'annual-physical-exam-telehealth',
  'chronic-disease-management-telehealth',
] as const;

/**
 * /our-services — Elementor post 50789: hero card, 3-column service cards,
 * closing journey CTA.
 */
export function OurServicesPageContent({
  services = serviceSummaries,
  bookingUrl,
}: {
  services?: typeof serviceSummaries;
  bookingUrl?: string;
}) {
  const bySlug = new Map(services.map((s) => [s.slug, s]));
  const ordered = LIVE_ORDER.map((slug) => bySlug.get(slug)).filter(Boolean) as typeof serviceSummaries;
  const extras = services.filter((s) => !LIVE_ORDER.includes(s.slug as (typeof LIVE_ORDER)[number]));
  const list = [...ordered, ...extras];

  return (
    <div className="bg-white">
      <InnerPageHero
        image={{
          src: '/images/sections/SERVIES-IMG.avif',
          alt: 'Comprehensive online mental health services',
        }}
        imageSide="left"
        title="Comprehensive Online"
        accent="Mental Health Services"
        lead="Personalized, evidence-based psychiatric care delivered through secure and convenient telehealth sessions as part of our comprehensive online mental health services, designed to support your long-term emotional wellness."
        leadSize="subhead"
      />

      <section
        aria-labelledby="our-services-heading"
        className="px-5 pb-16 sm:max-[1601px]:px-[30px] sm:pb-24 lg:max-[1601px]:px-10 lg:pb-[150px] min-[1601px]:px-[80px]"
      >
        <div className="mx-auto max-w-[1840px]">
          {/* sr-only: the hero above renders the page's <h1>, and each
              ServicesGrid card renders an <h3> — this closes the h1->h3
              gap with no visual change (ServicesGrid is shared across
              other pages that already have their own h2 before it, so
              the fix is scoped to this page rather than to that
              component). */}
          <h2 id="our-services-heading" className="sr-only">
            Our Services
          </h2>
          <p className="mx-auto -mt-2 mb-10 max-w-[52ch] text-center text-[15px] leading-[1.5] text-[#374151] sm:mb-12">
            Questions about cost or whether we serve your state?{' '}
            <Link
              href="/fees-insurance"
              className="font-semibold text-[var(--lw-accent)] underline-offset-2 hover:underline"
            >
              View Fees &amp; Insurance
            </Link>
            .
          </p>
          <ServicesGrid services={list} columns={3} className="lg:gap-10" />
        </div>
      </section>

      <JourneyCta
        href={bookingUrl}
        image={{
          src: '/images/sections/Online-Mental-Health-Services.avif',
          alt: 'Online Mental Health Services',
          width: 1180,
          height: 990,
        }}
        imageSide="left"
        trackAs="booking_click"
      />
    </div>
  );
}
