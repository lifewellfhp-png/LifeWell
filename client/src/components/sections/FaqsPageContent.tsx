import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { FAQAccordion } from '@/components/sections/FAQAccordion';
import { faqs as staticFaqs } from '@/data/marketing';
import type { Faq } from '@/types/content';

/**
 * /faqs — Elementor post 51032: rounded hero card, then cmsmasters toggles.
 * Live page has no extra “still have a question” box or closing CTA.
 */
export function FaqsPageContent({ faqs = staticFaqs }: { faqs?: Faq[] }) {
  return (
    <div className="bg-white">
      <InnerPageHero
        title="Frequently Asked"
        accent="Questions"
        lead="Find answers to common questions about telehealth mental health services, appointments, insurance, fees, and how to get started with care."
        leadSize="subhead"
      />

      <section className="px-5 pb-16 sm:max-[1601px]:px-[30px] sm:pb-24 lg:max-[1601px]:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto max-w-[920px]">
          <FAQAccordion faqs={faqs} headingLevel={2} variant="toggles" />
        </div>
      </section>
    </div>
  );
}
