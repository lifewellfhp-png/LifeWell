import type { Metadata } from 'next';
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

import { site } from '@/data/site';
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
      <WelcomeSection welcome={cms.welcome} />

      <Section tone="raised" aria-labelledby="services-heading">
        <Container>
          <SectionHeading
            eyebrow={cms.servicesIntro.eyebrow}
            eyebrowVariant="badge"
            title="How I"
            accent="Help"
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
      <InsuranceGrid showCta={true} showDisclaimer={true} carriers={cms.insurance} />
      <Testimonials testimonials={cms.testimonials} />
      <VideosSection videos={cms.videos} />
      <ContactCTA bookingUrl={cms.booking.page} bookingLabel={cms.booking.label} />
    </>
  );
}
