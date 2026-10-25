import Link from 'next/link';
import Image from 'next/image';
import { site } from '@/data/site';
import {
  footerMentalHealthLinks,
  footerPrimaryCareLinks,
  footerConditionsLinks,
  footerPatientResourceLinks,
  footerLocationLinks,
  footerProfessionalLinks,
  footerTelehealthLinks,
  legalLinks,
} from '@/data/navigation';
import { Container } from '@/components/ui/Section';
import { FooterNewsletter } from '@/components/forms/NewsletterForm';
import { FooterNav } from '@/components/layout/FooterNav';
import { newsletter } from '@/data/marketing';
import { getResolvedContent } from '@/lib/cms-resolve';
import { isOptimizableImageSrc } from '@/lib/site-asset';
import type { ReactNode } from 'react';

export async function Footer() {
  const cms = await getResolvedContent();
  const primary = cms.locations.find((row) => row.isPrimary) ?? cms.locations[0];
  const phone = cms.settings.practicePhone || primary?.phone || site.contact.phone;
  const email = cms.settings.practiceEmail || primary?.email || site.contact.email;
  const phoneHref = phone.replace(/[^\d+]/g, '').length ? `tel:+1${phone.replace(/\D/g, '').replace(/^1/, '')}` : site.contact.phoneHref;
  const logo = cms.settings.logoUrl || '/images/brand/logo-v2.avif';
  const optimizableLogo = isOptimizableImageSrc(logo);

  return (
    <footer className="bg-[#F4F7FA] pb-[env(safe-area-inset-bottom)]">
      {/* Newsletter band (Phase 24 homepage reorg) — now its own dark-green
          band, visually separate from the navy footer-proper band below it.
          Previously the newsletter row was just the top of that same navy
          band. */}
      <div className="newsletter-band rounded-t-[30px] bg-[var(--color-brand-accent-strong)] text-white sm:rounded-t-[40px]">
        <Container>
          <div className="flex flex-col gap-5 py-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:py-12 lg:py-14">
            <h2 className="max-w-[16ch] font-heading text-[28px] font-normal leading-[1.2] text-white sm:max-desktop:text-[34px] lg:max-w-[18ch] desktop:text-[42px]">
              {newsletter.heading}
            </h2>
            <FooterNewsletter />
          </div>
        </Container>
      </div>

      <div className="footer-band bg-[var(--lw-primary)] text-white">
        <Container>
          <div className="grid min-w-0 grid-cols-1 gap-x-10 gap-y-10 py-14 md:grid-cols-2 md:gap-y-12 md:py-[72px] xl:grid-cols-12">
            <div className="md:col-span-2 xl:col-span-4">
              <Link
                href="/"
                className="inline-flex rounded-[12px] bg-white px-3 py-2.5 sm:px-4 sm:py-3"
                aria-label={`${site.name} — home`}
              >
                {optimizableLogo ? (
                  <Image
                    src={logo}
                    alt={site.name}
                    width={945}
                    height={191}
                    loading="lazy"
                    className="h-8 w-auto sm:h-10"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={site.name} loading="lazy" className="h-8 w-auto sm:h-10" />
                )}
              </Link>
              <p className="mt-6 max-w-[38ch] font-body text-[15px] font-normal leading-[1.7] text-[#c9d4ec]">
                LifeWell Family Health &amp; Psychiatry provides compassionate psychiatric and
                primary care, by secure telehealth or in our Orlando office.
              </p>

              <address className="mt-6 max-w-[42ch] font-body text-[15px] not-italic leading-[1.7] text-[#c9d4ec]">
                <ul className="space-y-3">
                  <ContactItem icon="pin" label="Address">
                    <a href="https://www.google.com/maps/dir/?api=1&destination=3680+Avalon+Park+E+Blvd%2C+Suite+310%2C+Orlando%2C+FL+32828" target="_blank" rel="noopener noreferrer">
                      {site.address.full}
                    </a>
                  </ContactItem>
                  <ContactItem icon="phone" label="Phone">
                    <a href={phoneHref}>{phone}</a>
                  </ContactItem>
                  <ContactItem icon="fax" label="Fax">
                    <span>{site.contact.fax}</span>
                  </ContactItem>
                  <ContactItem icon="mail" label="Email">
                    <a href={`mailto:${email}`}>{email}</a>
                  </ContactItem>
                </ul>
              </address>

              <Link href={site.booking.page} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#028815] px-5 py-3.5 font-body text-[15px] font-semibold text-white no-underline transition-colors hover:bg-[#02750f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto">
                Book an Appointment <span aria-hidden="true">→</span>
              </Link>
            </div>

            <FooterNav heading="Mental Health" links={footerMentalHealthLinks} subheading="Conditions" sublinks={footerConditionsLinks} className="xl:col-span-2" />
            <FooterNav heading="Primary Care" links={footerPrimaryCareLinks} className="xl:col-span-2" />
            <FooterNav heading="Patient Resources" links={footerPatientResourceLinks} className="xl:col-span-2" />
            <FooterNav heading="Locations & Professionals" links={footerLocationLinks} subheading="Telehealth" sublinks={footerTelehealthLinks} secondSubheading="For Professionals" secondSublinks={footerProfessionalLinks} className="xl:col-span-2" />
          </div>

          {/*
            Bottom row: copyright left, credit right — a two-column flex
            row (stacked, centered on mobile) rather than one centered
            block.
          */}
          <div className="flex flex-col gap-3 border-t border-white/15 py-6 text-left sm:flex-row sm:items-baseline sm:justify-between">
            <p className="font-body text-[12px] leading-relaxed text-[#c9d4ec] sm:text-[13px]">
              © {new Date().getFullYear()} {site.legalName}. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-[12px] leading-relaxed text-[#c9d4ec] sm:text-[13px]">
              {legalLinks.map((link, index) => (
                <span key={link.href} className="inline-flex items-center gap-x-2">
                  {index > 0 ? <span aria-hidden="true">·</span> : null}
                  <Link href={link.href} className="hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{link.label.replace(' Statement', '').replace(' / Communication Policy', '')}</Link>
                </span>
              ))}
              <span className="hidden sm:inline" aria-hidden="true">·</span>
              <span>Designed &amp; Engineered by Wesly Chachoute</span>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}

function ContactItem({ icon, label, children }: { icon: 'pin' | 'phone' | 'fax' | 'mail'; label: string; children: ReactNode }) {
  return <li className="flex gap-3"><ContactIcon name={icon} /><span><span className="mr-2 text-[11px] font-semibold uppercase tracking-[1.2px] text-[#9fb0d6]">{label}</span>{children}</span></li>;
}

function ContactIcon({ name }: { name: 'pin' | 'phone' | 'fax' | 'mail' }) {
  const paths = {
    pin: 'M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    phone: 'M6.6 3.2 9 2.5l1.6 4-1.5 1.2a15 15 0 0 0 3.2 3.2l1.2-1.5 4 1.6-.7 2.4c-.3 1-1.3 1.6-2.3 1.4A13.5 13.5 0 0 1 5.2 5.5c-.2-1 .4-2 1.4-2.3Z',
    fax: 'M5 8V3h10v5M5 17H3V9h18v8h-2M7 13h10v8H7v-8Zm3 3h4',
    mail: 'M3 5h18v14H3V5Zm1 1 8 6 8-6',
  } as const;
  return <svg aria-hidden="true" className="mt-1 size-5 shrink-0 text-[#4cc25a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function SocialIcon({ name }: { name: string }) {
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
