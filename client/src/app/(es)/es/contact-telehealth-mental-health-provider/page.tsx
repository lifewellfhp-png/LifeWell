import type { Metadata } from 'next';
import { Container, Section } from '@/components/ui/Section';
import { ContactForm } from '@/components/forms/ContactForm';
import { pageMetadata } from '@/lib/seo';
import { site, formatCareLanguagesEs } from '@/data/site';
import { contactPage } from '@/data/contact';
import { contactEs } from '@/data/es/contact';

const DESCRIPTION =
  'Llama al (407) 603-1717 para programar tu cita. Visitas en persona en Orlando y telesalud para Florida, Massachusetts y Arizona.';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Contáctanos | Oficina de Orlando y Telesalud | LifeWell',
    description: DESCRIPTION,
    path: '/es/contact-telehealth-mental-health-provider',
    ogLocale: 'es_US',
    alternateLocale: { en: '/contact-telehealth-mental-health-provider' },
  });
}

const DAY_NAMES_ES: Record<string, string> = {
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
  Closed: 'Cerrado',
};

/** "Monday–Friday | 10:00 AM–4:00 PM EST" -> "Lunes–Viernes | 10:00 AM–4:00 PM EST". */
function translateHoursLine(line: string): string {
  const [dayPart, ...rest] = line.split('|');
  const translatedDay = (dayPart ?? '').replace(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Closed/g, (m) => DAY_NAMES_ES[m] ?? m);
  return [translatedDay, ...rest].join('|');
}

/**
 * [REVIEW]: Spanish copy needs a native-speaker check. The ContactForm
 * below is reused as-is (English labels/validation) — fully localizing
 * the form itself was out of scope for this pass, noted in the final
 * report; it is fully functional either way (item 15's requirement).
 */
export default function ContactPageEs() {
  return (
    <Section tone="base" spacing="lg">
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <h1 className="font-heading text-[30px] font-normal text-[var(--lw-primary)] desktop:text-[42px]">
              {contactEs.heading}
            </h1>
            <p className="mt-4 text-[15px] text-text-secondary">{contactEs.intro}</p>

            <h2 className="mt-8 text-[12px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)]">
              {contactEs.emailLabel}
            </h2>
            <p className="mt-1">
              <a href={site.contact.emailHref} className="text-text-primary no-underline hover:text-[var(--lw-primary)]">
                {site.contact.email}
              </a>
            </p>

            <h2 className="mt-6 text-[12px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)]">
              {contactEs.languagesLabel}
            </h2>
            <p className="mt-1 text-[15px] text-text-secondary">{formatCareLanguagesEs()}</p>

            <h2 className="mt-6 text-[12px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)]">
              {contactEs.officeHoursLabel}
            </h2>
            <div className="mt-1 space-y-1 text-[15px] text-text-secondary">
              {contactPage.hours.map((line) => (
                <p key={line}>{translateHoursLine(line)}</p>
              ))}
            </div>

            <h2 className="mt-6 text-[12px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)]">
              {contactEs.telehealthHoursLabel}
            </h2>
            <div className="mt-1 space-y-1 text-[15px] text-text-secondary">
              {contactPage.telehealthHours.map((line) => (
                <p key={line}>{translateHoursLine(line)}</p>
              ))}
            </div>

            <h2 className="mt-6 text-[12px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)]">
              {contactEs.addressLabel}
            </h2>
            <address className="mt-1 not-italic text-[15px] text-text-secondary">
              {site.address.street}, {site.address.suite}
              <br />
              {site.address.city}, {site.address.state} {site.address.zip}
            </address>
          </div>

          <div>
            <p className="mb-4 text-[13px] italic text-text-secondary">{contactEs.formNote}</p>
            <ContactForm />
          </div>
        </div>
      </Container>
    </Section>
  );
}
