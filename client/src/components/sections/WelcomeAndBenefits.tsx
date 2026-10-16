import Image from 'next/image';
import { Container, Section } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { welcome as staticWelcome, benefitsSection } from '@/data/marketing';
import { benefits as staticBenefits } from '@/data/marketing';
import type { Benefit } from '@/types/content';

function WelcomeHeading({ heading }: { heading: string }) {
  const branded = /^welcome to\s+lifewell(\s+family health\s*&\s*psychiatry)?$/i.test(heading.trim());
  if (branded) {
    return (
      <h2
        id="welcome-heading"
        className="font-heading text-[28px] font-normal leading-[1.2] tracking-normal sm:max-desktop:text-[38px] desktop:text-[44px]"
      >
        <span className="whitespace-nowrap">
          <span className="text-[var(--lw-accent)] not-italic">Welcome to </span>
          <span className="italic text-[var(--lw-primary)]">LifeWell</span>
        </span>
        <span className="block italic text-[var(--lw-primary)]">
          Family Health &amp;
          <br />
          Psychiatry
        </span>
      </h2>
    );
  }

  return (
    <h2
      id="welcome-heading"
      className="font-heading text-[28px] font-normal italic leading-[1.2] tracking-normal text-[var(--lw-primary)] sm:max-desktop:text-[38px] desktop:text-[44px]"
    >
      {heading}
    </h2>
  );
}

/**
 * "Welcome to LifeWell" text merged with "Why Patients Choose LifeWell"
 * (Phase 24 homepage reorg) — one section instead of two: welcome text and
 * image on the left, the numbered benefits on the right. Both halves reuse
 * the same CMS-resolved content the two separate sections (WelcomeSection,
 * BenefitsGrid) used before; neither of those components was deleted —
 * BenefitsGrid is still used standalone on service pages
 * (ServicePageContent.tsx) and is untouched.
 */
export function WelcomeAndBenefits({
  welcome = staticWelcome,
  benefitsHeading = benefitsSection.heading,
  benefits = staticBenefits,
}: {
  welcome?: typeof staticWelcome;
  benefitsHeading?: string;
  benefits?: Benefit[];
}) {
  return (
    <Section tone="raised" aria-labelledby="welcome-heading">
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-x-[70px]">
          <div>
            <div className="overflow-hidden rounded-[12px]">
              <Image
                src={welcome.image.src}
                alt={welcome.image.alt}
                width={welcome.image.width}
                height={welcome.image.height}
                loading="lazy"
                sizes="(min-width: 1024px) 46vw, 92vw"
                className="w-full object-cover"
              />
            </div>

            <div className="mt-6 sm:mt-8">
              <WelcomeHeading heading={welcome.heading} />
            </div>

            <div className="mt-4 space-y-3 sm:space-y-4">
              {welcome.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="text-[14px] font-normal leading-[1.45] text-[#374151] sm:text-[16px]"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-8">
              <SwapButton href={welcome.cta.href}>{welcome.cta.label}</SwapButton>
            </div>
          </div>

          <div>
            <h3 className="font-heading text-[24px] font-normal leading-[1.2] tracking-normal text-[var(--lw-primary)] sm:text-[30px]">
              {benefitsHeading}
            </h3>
            <ul className="mt-6 flex list-none flex-col gap-3 sm:mt-8">
              {benefits.map((benefit, i) => (
                <li key={benefit.title}>
                  <article className="flex items-start gap-4 rounded-[16px] bg-[#EEF2FA] px-4 py-4 sm:px-5 sm:py-5">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--lw-accent)] font-heading text-[15px] font-normal leading-none text-white sm:size-10 sm:text-[16px]"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-body text-[16px] font-semibold leading-snug text-[var(--lw-primary)] sm:text-[17px]">
                        {benefit.title}
                      </h4>
                      <p className="mt-1 text-[13.5px] leading-[1.45] text-[#374151] sm:text-[14.5px]">
                        {benefit.description}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
