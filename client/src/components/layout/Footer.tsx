import Link from 'next/link';
import Image from 'next/image';
import { site } from '@/data/site';
import { footerColumns } from '@/data/navigation';
import { Container } from '@/components/ui/Section';
import { FooterNewsletter } from '@/components/forms/NewsletterForm';
import { newsletter } from '@/data/marketing';
import { getResolvedContent } from '@/lib/cms-resolve';

export async function Footer() {
  const cms = await getResolvedContent();
  const primary = cms.locations.find((row) => row.isPrimary) ?? cms.locations[0];
  const phone = cms.settings.practicePhone || primary?.phone || site.contact.phone;
  const email = cms.settings.practiceEmail || primary?.email || site.contact.email;
  const phoneHref = phone.replace(/[^\d+]/g, '').length ? `tel:+1${phone.replace(/\D/g, '').replace(/^1/, '')}` : site.contact.phoneHref;
  const logo = cms.settings.logoUrl || '/images/brand/logo-v2.avif';
  const remoteLogo = logo.startsWith('http');
  return (
    <footer className="bg-[#F4F7FA] pb-[env(safe-area-inset-bottom)]">
      <div className="footer-band rounded-t-[30px] bg-[var(--lw-primary)] text-white sm:rounded-t-[40px]">
        <Container>
          <div className="flex flex-col gap-5 border-b border-white/30 py-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:py-12 lg:py-14">
            <h2 className="max-w-[16ch] font-heading text-[28px] font-normal leading-[1.2] text-white sm:text-[34px] lg:max-w-[18ch] min-[1181px]:text-[42px]">
              {newsletter.heading}
            </h2>
            <FooterNewsletter />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-10 py-10 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 xl:grid-cols-4 xl:gap-x-10 xl:py-14">
            <div>
              <Link
                href="/"
                className="inline-flex rounded-[12px] bg-white px-3 py-2.5 sm:px-4 sm:py-3"
                aria-label={`${site.name} — home`}
              >
                {remoteLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={site.name} className="h-8 w-auto sm:h-10" />
                ) : (
                  <Image
                    src={logo}
                    alt={site.name}
                    width={945}
                    height={191}
                    className="h-8 w-auto sm:h-10"
                  />
                )}
              </Link>
              <p className="mt-6 max-w-[38ch] font-body text-[15px] font-normal leading-[1.6] text-white sm:text-[16px]">
                {site.footerBlurb}
              </p>

              <address className="mt-5 space-y-1.5 font-body text-[15px] font-normal not-italic leading-relaxed text-white sm:text-[16px]">
                {primary?.street || primary?.address ? (
                  <p>
                    {primary.street || primary.address}
                    {primary.city ? (
                      <>
                        <br />
                        {[primary.city, primary.region, primary.postalCode].filter(Boolean).join(', ')}
                      </>
                    ) : null}
                  </p>
                ) : null}
                <p>
                  Phone:-{' '}
                  <a href={phoneHref} className="text-white no-underline hover:underline">
                    {phone}
                  </a>
                </p>
                <p>Fax:- {site.contact.fax}</p>
                <p>
                  Email:-{' '}
                  <a href={`mailto:${email}`} className="text-white no-underline hover:underline">
                    {email}
                  </a>
                </p>
              </address>

              <ul className="mt-6 flex gap-3">
                {site.social.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--lw-accent)] text-white transition-colors duration-300 hover:bg-white hover:text-[var(--lw-accent)]"
                    >
                      <span className="sr-only">
                        {site.name} on {s.name}
                      </span>
                      <SocialIcon name={s.name} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {footerColumns.map((col) => (
              <nav key={col.heading} aria-label={col.heading} className="min-w-0">
                <h3 className="font-heading text-[20px] font-normal leading-[1.3] text-white sm:text-[22px] min-[1181px]:text-[24px]">
                  {col.heading}
                </h3>
                <ul className="mt-5 flex flex-col gap-3 sm:gap-3.5">
                  {col.links.map((link) => (
                    <li key={link.href} className="min-w-0">
                      <Link
                        href={link.href}
                        prefetch
                        className="break-words font-body text-[15px] font-normal leading-snug text-white no-underline transition-opacity duration-300 hover:opacity-80 sm:text-[16px]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="border-t border-white/30 py-5 text-center sm:py-6">
            <p className="font-body text-[13px] font-normal leading-relaxed text-white sm:text-[14px]">
              © 2026 {site.name}. All Rights Reserved. | Website Design & Development by
              Wesly Chachoute, M.S. in Cybersecurity | DBA Candidate
            </p>
          </div>
        </Container>
      </div>
    </footer>
  );
}

function SocialIcon({ name }: { name: string }) {
  const common = {
    'aria-hidden': true as const,
    focusable: 'false' as const,
    width: 15,
    height: 15,
    fill: 'currentColor',
  };

  if (name === 'Facebook') {
    return (
      <svg {...common} viewBox="0 0 320 512">
        <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
      </svg>
    );
  }
  if (name === 'LinkedIn') {
    return (
      <svg {...common} viewBox="0 0 448 512">
        <path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z" />
      </svg>
    );
  }
  return (
    <svg {...common} viewBox="0 0 448 512">
      <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
    </svg>
  );
}
