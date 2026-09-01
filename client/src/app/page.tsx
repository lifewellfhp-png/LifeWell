import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { Hero } from '@/components/sections/Hero';
import { WelcomeSection } from '@/components/sections/WelcomeSection';
import { ServicesGrid } from '@/components/sections/ServicesGrid';
import { BenefitsGrid } from '@/components/sections/BenefitsGrid';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { StatsBand } from '@/components/sections/StatsBand';
import { InsuranceGrid } from '@/components/sections/InsuranceGrid';
import { Testimonials } from '@/components/sections/Testimonials';
import { ContactCTA } from '@/components/sections/CTASection';
import { VideosSection } from '@/components/sections/VideosSection';
import { TrustStrip } from '@/components/sections/TrustStrip';

import { site } from '@/data/site';
import { provider as staticProvider } from '@/data/provider';
import { cmsMetadata } from '@/lib/cms-seo';
import { getResolvedContent } from '@/lib/cms-resolve';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Telehealth Mental Health Care | PMHNP Online Therapy & Medication Management',
    description: site.description,
    path: '/',
  });
}

/**
 * Homepage.
 *
 * Content prefers live CMS values when present, otherwise the static rebuild data.
 */
export default async function HomePage() {
  const cms = await getResolvedContent();

  return (
    <>
      <Hero
        hero={cms.hero}
        bookingUrl={cms.booking.page}
        bookingLabel={cms.booking.label}
        bookingProfiles={cms.bookingProfiles}
      />
      <TrustStrip
        provider={cms.provider ?? staticProvider}
        states={cms.telehealthStates}
      />
      <WelcomeSection welcome={cms.welcome} />

      <Section tone="muted" spacing="sm" aria-labelledby="preceptorship-home-heading" className="bg-[#F4F7FA]">
        <Container>
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-10">
            <div>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lw-accent)] sm:text-[13px]">
                Preceptorship Program
              </p>
              <h2 id="preceptorship-home-heading" className="max-w-[16ch] font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] text-[var(--lw-primary)] sm:text-[42px] min-[1181px]:text-[52px]">
                Clinical learning for PMHNP and FNP students
              </h2>
              <p className="mt-5 max-w-[62ch] text-[15px] leading-[1.55] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
                LifeWell Family Health &amp; Psychiatry offers structured preceptorship opportunities for PMHNP and Family Nurse Practitioner students seeking meaningful clinical learning experiences. Our program emphasizes professional mentorship, clinical reasoning, guided learning, and the development of confidence in advanced practice nursing.
              </p>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.55] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
                Opportunities are based on preceptor availability, student qualifications, academic requirements, and completion of required school or affiliation agreements.
              </p>
              <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <SwapButton href="/preceptorship-program">Explore Preceptorship Opportunities</SwapButton>
                <Link
                  href="/contact-telehealth-mental-health-provider"
                  className="inline-flex min-h-[51px] items-center justify-center rounded-[30px] border border-[var(--lw-primary)] px-[30px] py-[14px] text-[16px] font-semibold text-[var(--lw-primary)] no-underline transition-colors duration-300 hover:bg-[var(--lw-primary)] hover:text-white min-[1181px]:text-[18px]"
                >
                  Contact Us
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-[#dfeaf3] bg-white p-3 shadow-[0_12px_40px_rgba(37,73,96,0.08)] sm:p-4">
              <Image
                src="/images/preceptorship/student-mentor-education.svg"
                alt="Advanced practice nursing student receiving clinical mentorship"
                width={800}
                height={600}
                priority={false}
                sizes="(min-width: 1024px) 40vw, 92vw"
                className="h-auto w-full rounded-[18px] object-cover"
              />
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="raised" aria-labelledby="services-heading">
        <Container>
          <SectionHeading
            eyebrow={cms.servicesIntro.eyebrow}
            eyebrowVariant="badge"
            title={cms.servicesIntro.heading}
            description={cms.servicesIntro.body}
            descriptionClassName="mt-6 max-w-[42ch] text-[18px] leading-[1.35] text-[#374151] sm:text-[20px] min-[1181px]:text-[22px]"
            id="services-heading"
            align="center"
          />
          <ServicesGrid
            services={cms.homeServices.slice(0, 4)}
            columns={4}
            className="mt-10 md:mt-[60px] min-[1181px]:mt-20"
          />
          <div className="mt-10 flex justify-center md:mt-[60px] min-[1181px]:mt-20">
            <SwapButton href="/our-services">{cms.servicesIntro.cta}</SwapButton>
          </div>
        </Container>
      </Section>

      <BenefitsGrid heading={cms.benefitsHeading} items={cms.benefits} />
      <HowItWorks
        bookingUrl={cms.booking.page}
        heading={cms.howItWorks.heading}
        eyebrow={cms.howItWorks.eyebrow}
        body={cms.howItWorks.body}
        steps={cms.steps}
      />
      <StatsBand stats={cms.stats} bookingUrl={cms.booking.page} />
      <InsuranceGrid
        showCta={true}
        showDisclaimer={true}
        heading={cms.insuranceSection.heading}
        body={cms.insuranceSection.body}
        disclaimer={cms.insuranceSection.disclaimer}
        ctaLabel={cms.insuranceSection.ctaLabel}
        ctaHref={cms.insuranceSection.ctaHref}
        carriers={cms.insurance}
      />
      <Testimonials testimonials={cms.testimonials} />
      <VideosSection videos={cms.videos} />
      <ContactCTA bookingUrl={cms.booking.page} bookingLabel={cms.booking.label} />
    </>
  );
}
