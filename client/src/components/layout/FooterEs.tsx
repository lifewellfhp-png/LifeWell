import Link from 'next/link';
import Image from 'next/image';
import { site, formatCareLanguagesEs } from '@/data/site';
import { Container } from '@/components/ui/Section';

/**
 * Spanish footer — a deliberately smaller link set than the English
 * Footer's full multi-column nav (which lists every service/condition
 * individually, translating which was out of scope for this pass). Same
 * contact facts (address/phone/email never need translating), same
 * visual band structure.
 */
const ES_FOOTER_LINKS = [
  { label: 'Inicio', href: '/es' },
  { label: 'Servicios', href: '/es/our-services' },
  { label: 'Tarifas y Seguro', href: '/es/fees-insurance' },
  { label: 'Nuevos Pacientes', href: '/es/new-patients' },
  { label: 'Preguntas Frecuentes', href: '/es/faqs' },
  { label: 'Contacto', href: '/es/contact-telehealth-mental-health-provider' },
  { label: 'Reservar una Cita', href: '/es/book-telehealth-mental-health-appointment' },
] as const;

export function FooterEs() {
  const logo = '/images/brand/logo-v2.avif';

  return (
    <footer className="bg-[#F4F7FA] pb-[env(safe-area-inset-bottom)]">
      <div className="footer-band rounded-t-[30px] bg-[var(--lw-primary)] text-white sm:rounded-t-[40px]">
        <Container>
          <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-10 py-10 sm:grid-cols-2 xl:py-14">
            <div>
              <Link
                href="/es"
                className="inline-flex rounded-[12px] bg-white px-3 py-2.5 sm:px-4 sm:py-3"
                aria-label={`${site.name} — inicio`}
              >
                <Image src={logo} alt={site.name} width={945} height={191} loading="lazy" className="h-8 w-auto sm:h-10" />
              </Link>
              <address className="mt-5 max-w-[42ch] font-body text-[15px] font-normal not-italic leading-relaxed text-white sm:text-[16px]">
                <p className="mb-4">
                  {site.address.street}, {site.address.suite}
                  <br />
                  {site.address.city}, {site.address.state} {site.address.zip}
                </p>
                <ul className="space-y-2.5">
                  <li className="flex items-baseline gap-x-2">
                    <span className="inline-block w-20 shrink-0 text-[11px] font-semibold uppercase tracking-[1px] text-white/60">
                      Teléfono
                    </span>
                    <a href={site.contact.phoneHref} className="text-white no-underline hover:underline">
                      {site.contact.phone}
                    </a>
                  </li>
                  <li className="flex items-baseline gap-x-2">
                    <span className="inline-block w-20 shrink-0 text-[11px] font-semibold uppercase tracking-[1px] text-white/60">
                      Correo
                    </span>
                    <a href={`mailto:${site.contact.email}`} className="break-all text-white no-underline hover:underline">
                      {site.contact.email}
                    </a>
                  </li>
                </ul>
              </address>
              <p className="mt-5 max-w-[42ch] text-[13px] leading-relaxed text-white/80">{formatCareLanguagesEs()}</p>
            </div>

            <nav aria-label="Enlaces" className="min-w-0">
              <h3 className="font-heading text-[20px] font-normal leading-[1.3] text-white desktop:text-[24px]">
                Enlaces
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {ES_FOOTER_LINKS.map((link) => (
                  <li key={link.href} className="min-w-0">
                    <Link
                      href={link.href}
                      prefetch
                      className="inline-block py-1 font-body text-[15px] font-normal leading-snug text-white no-underline transition-opacity duration-300 hover:opacity-80 focus-visible:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[16px]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/"
                    prefetch
                    className="inline-block py-1 font-body text-[14px] italic leading-snug text-white/70 no-underline hover:opacity-80"
                  >
                    English site →
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="flex flex-col items-center gap-2 border-t border-white/20 py-6 text-center sm:flex-row sm:items-baseline sm:justify-between sm:text-left">
            <p className="font-body text-[12px] leading-relaxed text-white/70 sm:text-[13px]">
              © 2026 {site.shortName}. Todos los derechos reservados.
            </p>
          </div>
        </Container>
      </div>
    </footer>
  );
}
