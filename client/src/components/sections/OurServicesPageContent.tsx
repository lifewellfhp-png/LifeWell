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

      <section className="px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto max-w-[1840px]">
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
      />
    </div>
  );
}
