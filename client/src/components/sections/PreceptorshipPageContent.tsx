import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { OutlineButton, SwapButton } from '@/components/ui/SwapButton';
import { InnerPageHero } from '@/components/sections/InnerPageHero';

const PRECEPTORSHIP_IMAGE = {
  src: '/images/preceptorship/student-mentor-education.svg',
  alt: 'Advanced practice nursing student receiving clinical mentorship in a professional healthcare setting',
  width: 1200,
  height: 900,
};

const steps = [
  {
    title: 'Choose Your Preceptorship Track',
    description:
      'Select the clinical track that best aligns with your academic program and rotation requirements, including PMHNP or Family Nurse Practitioner experiences when available.',
    Icon: GraduationCapIcon,
  },
  {
    title: 'Submit Your Preceptorship Request',
    description:
      'Provide your contact information, school or university, requested rotation dates, required clinical hours, program track, and applicable school requirements for review.',
    Icon: FileTextIcon,
  },
  {
    title: 'Application & Placement Review',
    description:
      'Our team reviews availability, academic requirements, rotation expectations, and required affiliation documentation before confirming a placement.',
    Icon: ClipboardCheckIcon,
  },
  {
    title: 'Begin Your Clinical Experience',
    description:
      'Once requirements and agreements are completed, students can begin their approved rotation with structured mentorship, clinical guidance, feedback, and supervised learning.',
    Icon: StethoscopeIcon,
  },
] as const;

const expectations = [
  'Professional mentorship',
  'Guided clinical learning',
  'Clinical reasoning development',
  'Communication skills',
  'Professional feedback',
  'Exposure to advanced-practice workflows',
  'Professional confidence and development',
] as const;

export function PreceptorshipPageContent() {
  return (
    <div className="bg-white">
      <InnerPageHero
        image={PRECEPTORSHIP_IMAGE}
        imageSide="right"
        title="Preceptorship"
        accent="Program"
        lead="Build your clinical experience through structured mentorship and guided learning with experienced advanced practice clinicians."
        leadSize="subhead"
      >
        <p className="text-[14px] leading-[1.45] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
          Opportunities are based on preceptor availability, student qualifications, academic requirements,
          and completion of required school or affiliation agreements.
        </p>
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SwapButton href="/contact-telehealth-mental-health-provider">Request Preceptorship Information</SwapButton>
          <OutlineButton href="#how-it-works" variant="onLight" showArrow={false}>
            How It Works
          </OutlineButton>
        </div>
      </InnerPageHero>

      <Section tone="transparent" spacing="sm" aria-labelledby="who-it-is-for-heading">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="who-it-is-for-heading"
            align="left"
            title="Who the Program Is For"
            description="Preceptorship opportunities may be available for students enrolled in qualified PMHNP or Family Nurse Practitioner programs who need supervised clinical experiences as part of their academic requirements."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[18px] border border-[#dfeaf3] bg-[#f6f9fb] p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lw-accent)]">
                PMHNP
              </p>
              <h3 className="mt-3 text-[24px] font-normal leading-[1.2] tracking-[-1px] text-[var(--lw-primary)]">
                Psychiatric-Mental Health Nurse Practitioner students
              </h3>
            </div>
            <div className="rounded-[18px] border border-[#dfeaf3] bg-[#f6f9fb] p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lw-accent)]">
                FNP
              </p>
              <h3 className="mt-3 text-[24px] font-normal leading-[1.2] tracking-[-1px] text-[var(--lw-primary)]">
                Family Nurse Practitioner students
              </h3>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="muted" spacing="sm" aria-labelledby="how-it-works-heading" id="how-it-works">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="how-it-works-heading"
            align="center"
            title="How It Works"
            description="A structured path toward guided clinical learning and professional growth."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map(({ title, description: body, Icon }, index) => (
              <article
                key={title}
                className="rounded-[20px] border border-[#dfeaf3] bg-white p-5 shadow-[0_10px_30px_rgba(42,67,87,0.04)] sm:p-6"
              >
                <div className="mb-5 inline-flex size-12 items-center justify-center rounded-full bg-[#eef3f7] text-[var(--lw-primary)]">
                  <Icon />
                </div>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lw-accent)]">
                  Step {index + 1}
                </p>
                <h3 className="text-[22px] font-normal leading-[1.2] tracking-[-1px] text-[var(--lw-primary)]">
                  {title}
                </h3>
                <p className="mt-4 text-[15px] leading-[1.6] text-[#374151]">{body}</p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="transparent" spacing="sm" aria-labelledby="students-can-expect-heading">
        <Container size="narrow">
          <SectionHeading
            as="h2"
            id="students-can-expect-heading"
            align="left"
            title="What Students Can Expect"
            description="A professional, supportive learning environment focused on skill-building, reflection, and clinical confidence."
          />

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {expectations.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-[16px] bg-[#eef3f7] px-4 py-4 text-[15px] leading-[1.45] text-[#374151]"
              >
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tone="transparent" spacing="sm" aria-label="Placement notice">
        <Container size="narrow">
          <div className="rounded-[18px] border border-[var(--lw-primary)]/20 bg-[#f4f9fd] p-5 sm:p-7">
            <p className="text-[16px] font-semibold leading-[1.45] text-[var(--lw-primary)] sm:text-[18px]">
              Preceptorship availability varies based on clinical schedules, academic requirements,
              preceptor capacity, and completion of required agreements. Submitting a request does not
              guarantee placement.
            </p>
          </div>
        </Container>
      </Section>

      <Section tone="inverse" aria-labelledby="preceptorship-final-cta-heading">
        <Container size="narrow">
          <div className="text-center">
            <h2
              id="preceptorship-final-cta-heading"
              className="mx-auto max-w-[22ch] text-[30px] font-normal leading-[1.15] tracking-normal text-text-inverse sm:text-[48px] min-[1181px]:text-[56px]"
            >
              Request Preceptorship Information
            </h2>
            <p className="mx-auto mt-6 max-w-[56ch] text-[16px] leading-[1.45] text-text-inverse/85 min-[1181px]:text-[18px]">
              Reach out to learn more about timing, qualifications, and next steps for the program.
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <SwapButton href="/contact-telehealth-mental-health-provider">Request Preceptorship Information</SwapButton>
              <OutlineButton href="#how-it-works" variant="onDark" showArrow={false}>
                How It Works
              </OutlineButton>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className="mt-0.5 shrink-0 text-[var(--lw-primary)]"
      fill="none"
    >
      <path d="M13.25 4.5 6.75 11l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GraduationCapIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2.5 8l9.5 5 9.5-5L12 3Z" />
      <path d="M5 9.5V14c0 2.2 3.1 4 7 4s7-1.8 7-4V9.5" />
      <path d="M12 13v7" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-4Z" />
      <path d="M14 3v4h4" />
      <path d="M8 12h8M8 16h8" />
    </svg>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M9 3v4h6V3" />
      <path d="m9.5 13 2 2 4.5-5" />
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v7a6 6 0 0 0 12 0V3" />
      <path d="M8 3v7" />
      <path d="M16 3v7" />
      <path d="M6 12v2a6 6 0 0 0 12 0v-2" />
      <path d="M9 19a3 3 0 0 0 6 0" />
    </svg>
  );
}

export const preceptorshipHeroImage = PRECEPTORSHIP_IMAGE;
