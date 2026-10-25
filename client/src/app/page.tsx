import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { Hero } from '@/components/sections/Hero';
import { ServicesGrid } from '@/components/sections/ServicesGrid';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { VideosSection } from '@/components/sections/VideosSection';
import { TrustStrip } from '@/components/sections/TrustStrip';
import { StatsBand } from '@/components/sections/StatsBand';
import { WelcomeAndBenefits } from '@/components/sections/WelcomeAndBenefits';
import { provider as staticProvider } from '@/data/provider';

// Below-the-fold, interactive-only sections — code-split out of the main
// bundle (SSR stays on, so content/markup and SEO are unaffected; only the
// hydration JS for these loads as a separate chunk instead of inflating the
// bundle every above-the-fold section shares).
const InsuranceGrid = dynamic(() => import('@/components/sections/InsuranceGrid').then((m) => m.InsuranceGrid));
const ContactCTA = dynamic(() => import('@/components/sections/CTASection').then((m) => m.ContactCTA));

import { site } from '@/data/site';
import { cmsMetadata } from '@/lib/cms-seo';
import { getResolvedContent } from '@/lib/cms-resolve';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Telehealth Mental Health Care | PMHNP Online Therapy & Medication Management',
    description: site.description,
    path: '/',
  });
}

/**
 * Homepage — reordered for Phase 24 (homepage reorg): Hero, four quick
 * cards, Services, How It Works, Insurance, Welcome+Benefits (merged, was
 * two separate sections), Watch and Learn, Contact. The newsletter band is
 * now global (Footer.tsx's own top band) rather than a homepage-specific
 * section. The sitewide crisis bar that briefly sat above the header was
 * removed per explicit follow-up request.
 *
 * TrustStrip's "Your provider" card was restored per explicit follow-up
 * request after the reorg briefly dropped it. Neither Stats ("A Foundation
 * of Experience") nor Testimonials render here — both are outside the
 * reorg's explicit 12-item homepage order. Neither component was deleted;
 * this page just no longer renders them.
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
      <TrustStrip provider={cms.provider ?? staticProvider} states={cms.telehealthStates} />
      <StatsBand stats={cms.stats.slice(0, 4)} compact />

      <Section tone="raised" aria-labelledby="services-heading">
        <Container>
          <SectionHeading
            eyebrow={cms.servicesIntro.eyebrow}
            eyebrowVariant="badge"
            title={cms.servicesIntro.heading}
            description={cms.servicesIntro.body}
            descriptionClassName="mt-6 max-w-[42ch] text-[18px] leading-[1.35] text-[#374151] sm:max-desktop:text-[20px] desktop:text-[22px]"
            id="services-heading"
            align="center"
          />
          <ServicesGrid
            services={cms.homeServices.slice(0, 4)}
            columns={4}
            className="mt-10 md:max-desktop:mt-[60px] desktop:mt-20"
          />
          <div className="mt-10 flex justify-center md:max-desktop:mt-[60px] desktop:mt-20">
            <SwapButton href="/our-services">{cms.servicesIntro.cta}</SwapButton>
          </div>
        </Container>
      </Section>

      <HowItWorks
        bookingUrl={cms.booking.page}
        heading={cms.howItWorks.heading}
        eyebrow={cms.howItWorks.eyebrow}
        body={cms.howItWorks.body}
        steps={cms.steps}
      />

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

      <WelcomeAndBenefits
        welcome={cms.welcome}
        benefitsHeading={cms.benefitsHeading}
        benefits={cms.benefits}
      />

      <VideosSection videos={cms.videos} />
      <ContactCTA bookingUrl={cms.booking.page} bookingLabel={cms.booking.label} />
    </>
  );
}
