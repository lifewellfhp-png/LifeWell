import { Container, Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';

/**
 * Shared shell for the 4 Spanish legal/policy pages — per the task's own
 * instruction, these carry only a short translated key-notice, not a
 * full legal translation; the complete legal text stays in English,
 * linked clearly rather than silently machine-translated. [REVIEW]:
 * Spanish copy needs a native-speaker check regardless.
 */
export function LegalNoticeEs({
  title,
  summary,
  englishHref,
}: {
  title: string;
  summary: string;
  englishHref: string;
}) {
  return (
    <Section tone="base" spacing="lg">
      <Container size="narrow">
        <h1 className="font-heading text-[28px] font-normal text-[var(--lw-primary)] desktop:text-[36px]">
          {title}
        </h1>
        <p className="mt-6 text-[15px] leading-[1.6] text-text-secondary">{summary}</p>
        <div className="mt-8 rounded-md border border-border-subtle bg-surface-muted px-6 py-5">
          <p className="text-[14px] text-text-secondary">
            El texto legal completo está disponible únicamente en inglés.
          </p>
          <div className="mt-4">
            <Button href={englishHref} variant="outline">
              Ver el texto completo en inglés
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
