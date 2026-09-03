import Image from 'next/image';
import { provider, providerPage } from '@/data/provider';
import { site } from '@/data/site';
import { stats, testimonials } from '@/data/marketing';
import { Container } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { TrackedBookingLink } from '@/components/ui/TrackedBookingLink';
import { StatsBand } from '@/components/sections/StatsBand';
import { ProviderTrustLinks } from '@/components/sections/BookingProfiles';
import type { BookingProfiles } from '@/lib/cms-resolve';

/**
 * /bio page — layout, type, and imagery from the live Elementor template
 * (post 50772). Hidden duplicate widgets and lorem-ipsum “Jon Doe” cards
 * are omitted; real patient quotes fill the three testimonial tiles.
 */
export function BioPageContent({
  overlay,
  testimonials: cmsTestimonials,
  stats: cmsStats,
  bookingUrl,
  phone,
  email,
  bookingProfiles,
}: {
  overlay?: {
    name?: string;
    credentials?: string;
    title?: string | null;
    bio?: string | null;
    photoUrl?: string | null;
    education?: string[];
    certifications?: string[];
  };
  testimonials?: typeof testimonials;
  stats?: typeof stats;
  bookingUrl?: string;
  phone?: string | null;
  email?: string | null;
  bookingProfiles?: BookingProfiles;
} = {}) {
  const featured = (cmsTestimonials?.length ? cmsTestimonials : testimonials).slice(0, 3);
  const bookHref = bookingUrl || site.booking.page;
  const display = {
    name: overlay?.name || provider.name,
    credentials: overlay?.credentials || provider.credentials,
    bio: overlay?.bio
      ? overlay.bio.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : provider.bio,
    photo: overlay?.photoUrl || provider.image.src,
  };
  const education =
    overlay?.education?.length ? overlay.education.join(' · ') : providerPage.educationBlurb;
  const board =
    overlay?.certifications?.length ? overlay.certifications.join(' · ') : providerPage.boardBlurb;

  return (
    <div className="bg-white">
      <BioHero overlay={display} phone={phone} email={email} />

      <section className="pb-16 sm:pb-24 lg:pb-[150px]">
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,32%)_minmax(0,68%)] lg:gap-[100px]">
            <aside className="text-center lg:px-10 lg:py-10">
              <h2 className="font-heading text-[22px] font-medium italic leading-[1.3] tracking-[-1px] text-[var(--lw-accent)] sm:text-[24px] min-[1181px]:text-[26px]">
                {providerPage.consultation.heading}
              </h2>
              <p className="mt-5 text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
                {providerPage.consultation.body}
              </p>
              <div className="mt-8 flex justify-center">
                <SwapButton href={bookHref} trackAs="booking_click">{providerPage.consultation.cta.label}</SwapButton>
              </div>
              {bookingProfiles && (
                <div className="flex justify-center">
                  <ProviderTrustLinks profiles={bookingProfiles} />
                </div>
              )}
            </aside>

            <div className="min-w-0">
              <h2 className="font-heading text-[28px] font-normal leading-[1.2] tracking-[-1px] text-[var(--lw-accent)] sm:text-[36px] min-[1181px]:text-[42px]">
                Short Biography
              </h2>
              <div className="mt-6 space-y-5">
                {display.bio.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
                    {paragraph}
                  </p>
                ))}
              </div>

              <h3 className="mt-12 font-heading text-[28px] font-normal leading-[1.2] tracking-[-1px] text-[var(--lw-accent)] sm:text-[36px] min-[1181px]:text-[42px]">
                Credentials
              </h3>

              <dl className="mt-8">
                <CredentialRow title="Education" body={education} />
                <CredentialRow title="Board certification" body={board} />
                <CredentialRow title="Field of expertise" body={providerPage.expertiseBlurb} />
                <CredentialRow title="Years of practice" body={providerPage.yearsBlurb} last />
              </dl>

              <h3 className="mt-10 font-heading text-[28px] font-normal leading-[1.2] tracking-[-1px] text-[var(--lw-accent)] sm:text-[36px] min-[1181px]:text-[42px]">
                Working Shifts
              </h3>
              <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {providerPage.shifts.map((shift) => (
                  <li key={shift.day}>
                    <TrackedBookingLink
                      href={bookHref}
                      className="flex flex-col items-center rounded-[15px] bg-[var(--lw-accent)] px-6 py-8 text-center no-underline transition-transform duration-300 hover:-translate-y-2.5"
                    >
                      <span className="text-[16px] font-semibold leading-snug text-white sm:text-[18px]">
                        {shift.day}
                      </span>
                      <span className="mt-2 text-[16px] font-normal leading-snug text-white sm:text-[18px]">
                        {shift.hours}
                      </span>
                    </TrackedBookingLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-24 lg:py-[150px]">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,55%)_minmax(0,45%)] lg:gap-8 min-[1601px]:gap-x-10">
            <div className="relative min-h-[250px] overflow-hidden rounded-[20px] sm:min-h-[400px] lg:min-h-[580px] lg:rounded-[30px]">
              <Image
                src={providerPage.philosophyImage.src}
                alt={providerPage.philosophyImage.alt}
                fill
                loading="lazy"
                sizes="(min-width: 1024px) 50vw, 92vw"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 lg:pr-0 min-[1601px]:pr-[100px]">
              <p className="text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
                {provider.approachIntro}
              </p>
              <p className="mt-6 text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
                My focus includes:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
                {provider.approach.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-6 text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
                {provider.approachOutcome}
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section
        aria-labelledby="bio-testimonials-heading"
        className="relative overflow-hidden bg-[#F4F7FA] py-16 sm:py-24 lg:py-[150px]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#e8f4f2_0%,_transparent_68%)]"
        />
        <Container className="relative">
          <div className="mx-auto max-w-[40rem] text-center">
            <p className="mx-auto w-fit rounded-[7px] bg-[#EEF3F7] px-4 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:text-[12px] min-[1181px]:text-[13px]">
              Testimonials
            </p>
            <h2 id="bio-testimonials-heading" className="sr-only">
              Testimonials
            </h2>
            <p className="mt-5 text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
              Honest feedback from patients who found support, understanding, and lasting care.
            </p>
          </div>

          <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {featured.map((item) => (
              <li
                key={item.author ?? item.quote.slice(0, 24)}
                className="rounded-[15px] bg-white p-7 sm:p-8"
              >
                <p className="text-center text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
                  {item.quote}
                </p>
                {item.author && (
                  <p className="mt-6 text-center text-[14px] font-bold text-[#374151] sm:text-[16px]">
                    {item.author}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <StatsBand stats={cmsStats ?? stats} bookingUrl={bookHref} />
    </div>
  );
}

function BioHero({
  overlay,
  phone,
  email,
}: {
  overlay: { name: string; credentials: string; photo: string };
  phone?: string | null;
  email?: string | null;
}) {
  const remotePhoto = overlay.photo.startsWith('http');
  const displayPhone = phone || site.contact.phone;
  const displayEmail = email || site.contact.email;
  const digits = displayPhone.replace(/\D/g, '').replace(/^1/, '');
  const phoneHref = digits ? `tel:+1${digits}` : site.contact.phoneHref;
  return (
    <section className="px-5 pb-16 pt-4 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
      <div className="mx-auto flex max-w-[1840px] flex-col-reverse overflow-hidden rounded-[20px] sm:rounded-[30px] lg:min-h-[570px] lg:flex-row">
        <div className="flex flex-col justify-center gap-8 bg-[#EEF3F7] px-5 py-10 sm:gap-10 sm:px-[60px] sm:py-[60px] lg:w-1/2 lg:px-20 lg:py-5 min-[1601px]:px-[100px]">
          <p className="w-fit rounded-[7px] bg-[var(--lw-accent)] px-4 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-white sm:text-[12px] min-[1181px]:text-[13px]">
            About Me
          </p>
          <h1 className="max-w-[16ch] font-heading text-[32px] font-normal leading-[1.1] tracking-[-3px] text-[var(--lw-accent)] sm:text-[44px] min-[1181px]:text-[56px] min-[1601px]:text-[62px]">
            {overlay.name}, {overlay.credentials}
          </h1>

          <ul className="w-full max-w-[28rem]">
            <li className="border-b border-[#ddd] py-[15px]">
              <a
                href={phoneHref}
                className="text-[16px] leading-[1.45] text-[#374151] no-underline hover:text-[var(--lw-primary)] min-[1181px]:text-[18px]"
              >
                Phone: {displayPhone}
              </a>
            </li>
            <li className="border-b border-[#ddd] py-[15px] text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
              Fax: {site.contact.fax}
            </li>
            <li className="py-[15px]">
              <a
                href={`mailto:${displayEmail}`}
                className="text-[16px] leading-[1.45] text-[#374151] no-underline hover:text-[var(--lw-primary)] min-[1181px]:text-[18px]"
              >
                Email: {displayEmail}
              </a>
            </li>
          </ul>

          <ul className="flex gap-[5px]">
            {site.social.map((s) => (
              <li key={s.name}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--lw-accent)] text-white transition-colors duration-300 hover:bg-[#2F6691]"
                >
                  <span className="sr-only">
                    {site.name} on {s.name}
                  </span>
                  <SocialGlyph name={s.name} />
                </a>
              </li>
            ))}
          </ul>

          <p className="max-w-[42ch] text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
            Personalized, compassionate psychiatric care and professional{' '}
            <strong className="font-semibold">PMHNP telehealth services</strong> designed to support
            your emotional wellness and long-term stability.
          </p>
        </div>

        <div className="relative min-h-[340px] sm:min-h-[500px] lg:min-h-[570px] lg:w-1/2">
          {remotePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={overlay.photo} alt={overlay.name} className="absolute inset-0 h-full w-full object-cover object-center" />
          ) : (
            <Image
              src={overlay.photo}
              alt={overlay.name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-center"
            />
          )}
        </div>
      </div>
    </section>
  );
}

function CredentialRow({
  title,
  body,
  last = false,
}: {
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div
      className={
        last
          ? 'grid gap-4 py-7 sm:grid-cols-[minmax(0,40%)_minmax(0,60%)] sm:gap-10 lg:gap-[100px]'
          : 'grid gap-4 border-b border-[#E1E8EE] py-7 sm:grid-cols-[minmax(0,40%)_minmax(0,60%)] sm:gap-10 lg:gap-[100px]'
      }
    >
      <dt className="font-heading text-[20px] font-medium italic leading-[1.3] tracking-[-1px] text-[var(--lw-accent)] sm:text-[24px] min-[1181px]:text-[26px]">
        {title}
      </dt>
      <dd className="text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">{body}</dd>
    </div>
  );
}

function SocialGlyph({ name }: { name: string }) {
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
