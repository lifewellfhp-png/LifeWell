import Image from 'next/image';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { benefits as staticBenefits, benefitsSection } from '@/data/marketing';
import type { Benefit } from '@/types/content';

/**
 * “Why Patients Choose My Telehealth Clinic”
 *
 * Live Elementor `cmsmasters-list-hover` rows: number + title + description
 * + arrow. On hover the row fills green, copy turns white, the number fades
 * out and the thumbnail slides in from below-left (fade-right).
 */
export function BenefitsGrid({
  heading = benefitsSection.heading,
  items = staticBenefits,
  tone = 'raised',
}: {
  heading?: string;
  items?: Benefit[];
  tone?: 'base' | 'muted' | 'raised';
}) {
  const match = heading.match(/^(.*?)\s+((?:My|Our)\s+.*)$/);
  const lead = match?.[1] ?? heading;
  const accent = match?.[2];

  return (
    <Section tone={tone} aria-labelledby="benefits-heading">
      <Container>
        <SectionHeading
          title={accent ? lead : heading}
          accent={accent}
          id="benefits-heading"
          align="center"
        />

        <ul className="mt-8 flex list-none flex-col gap-2 min-[1181px]:mt-16">
          {items.map((benefit, i) => (
            <li key={benefit.title}>
              <article className="group flex min-h-[120px] items-center gap-[15px] overflow-hidden rounded-[30px] bg-[#EEF3F7] px-5 py-4 transition-colors duration-500 hover:bg-[var(--lw-accent)] max-[767px]:flex-col max-[767px]:items-start sm:px-[30px] sm:py-[24px]">
                <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center sm:h-[88px] sm:w-[88px]">
                  <span
                    aria-hidden="true"
                    className="font-heading text-[22px] font-normal leading-none tracking-[-1px] text-[#4A8F55] transition-opacity duration-500 group-hover:opacity-0 sm:text-[24px] min-[1181px]:text-[30px]"
                  >
                    {i + 1}
                  </span>
                  <Image
                    src={benefit.image.src}
                    alt=""
                    width={150}
                    height={150}
                    loading="lazy"
                    sizes="88px"
                    className="pointer-events-none absolute inset-0 h-full w-full rounded-[16px] object-cover opacity-0 [transform:translate(-18px,28px)] transition-[opacity,transform] duration-500 ease-out group-hover:opacity-100 group-hover:[transform:translate(0,0)]"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2 transition-transform duration-500 ease-out group-hover:translate-x-2 sm:flex-row sm:items-center sm:gap-8">
                  <h3 className="w-full shrink-0 font-body text-[18px] font-semibold leading-snug tracking-normal text-[var(--lw-primary)] transition-colors duration-500 group-hover:text-white sm:w-[240px] sm:text-[20px] min-[1181px]:w-[280px] min-[1181px]:text-[22px]">
                    {benefit.title}
                  </h3>
                  <p className="min-w-0 flex-1 text-[14px] leading-[1.45] text-[#374151] transition-colors duration-500 group-hover:text-white sm:text-[16px] min-[1181px]:text-[18px]">
                    {benefit.description}
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className="ml-auto inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--lw-primary)] text-white max-[767px]:mt-2"
                >
                  <ArrowIcon />
                </span>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
      <path d="M313.941 216H12c-6.627 0-12 5.373-12 12v56c0 6.627 5.373 12 12 12h301.941v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.569 0-33.941l-86.059-86.059c-15.119-15.119-40.971-4.411-40.971 16.971V216z" />
    </svg>
  );
}
