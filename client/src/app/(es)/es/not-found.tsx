import type { Metadata } from 'next';
import { Container, Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { site } from '@/data/site';

/**
 * [REVIEW]: Spanish text needs a native-speaker check.
 *
 * Next.js requires a not-found.tsx inside each root-layout group (see
 * (es)/layout.tsx's doc comment on why this app has two root layouts) —
 * without one, a notFound() call inside this group has no valid parent
 * to render it with the right <html lang>, since each root group is its
 * own document root.
 */
export const metadata: Metadata = {
  title: 'Página no encontrada',
  description: 'No pudimos encontrar la página que buscas.',
  robots: { index: false, follow: true },
};

export default function NotFoundEs() {
  return (
    <Section tone="raised" spacing="lg">
      <Container size="narrow">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-h1 text-brand-primary" aria-hidden="true">
            404
          </p>
          <h1 className="mt-4">No pudimos encontrar esa página</h1>
          <p className="mt-6 text-lead text-text-secondary">
            La página que buscas puede haberse movido o ya no existe. Aquí hay algunos lugares que
            podrían ayudarte.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row sm:flex-wrap">
            <Button href="/es" size="lg">
              Volver al inicio
            </Button>
            <Button href="/es/our-services" variant="outline" size="lg">
              Ver servicios
            </Button>
          </div>

          <div className="mt-12 rounded-md border border-border-subtle bg-surface-muted px-6 py-6 text-left">
            <h2 className="text-h5">¿Necesitas contactarnos?</h2>
            <p className="mt-3 text-sm text-text-secondary">
              Llama al{' '}
              <a href={site.contact.phoneHref} className="font-semibold text-text-link">
                {site.contact.phone}
              </a>{' '}
              o escribe a{' '}
              <a href={site.contact.emailHref} className="font-semibold text-text-link">
                {site.contact.email}
              </a>
              . Si estás en crisis, llama o envía un mensaje de texto al{' '}
              <a href={site.crisis.phoneHref} className="font-semibold text-crisis">
                988
              </a>
              .
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
