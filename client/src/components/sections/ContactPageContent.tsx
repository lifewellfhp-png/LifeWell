import Image from 'next/image';
import { ContactForm } from '@/components/forms/ContactForm';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { SwapButton } from '@/components/ui/SwapButton';
import { contactPage } from '@/data/contact';
import { site } from '@/data/site';

export type ContactCms = {
  phone: string;
  email: string;
  hours: string[];
  street: string;
  cityLine: string;
  mapSrc: string;
  bookingUrl: string;
};

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^1/, '');
  return digits ? `tel:+1${digits}` : site.contact.phoneHref;
}

/**
 * /contact-telehealth-mental-health-provider — Elementor post 50990:
 * hero card (copy left, photo right), contact + map, ask-a-question form.
 */
export function ContactPageContent({ contact }: { contact?: ContactCms } = {}) {
  const phone = contact?.phone || site.contact.phone;
  const email = contact?.email || site.contact.email;
  const hours = contact?.hours?.length ? contact.hours : contactPage.hours;
  const street = contact?.street || site.address.street;
  const cityLine =
    contact?.cityLine || `${site.address.city}, ${site.address.state} ${site.address.zip}`;
  const mapSrc = contact?.mapSrc || contactPage.mapSrc;
  const bookingUrl = contact?.bookingUrl || site.booking.page;
  const phoneHref = telHref(phone);
  const emailHref = `mailto:${email}`;
  const smsHref = phoneHref.replace('tel:', 'sms:');

  return (
    <div className="bg-white">
      <ContactHero
        phone={phone}
        phoneHref={phoneHref}
        emailHref={emailHref}
        smsHref={smsHref}
        bookingUrl={bookingUrl}
      />

      <section className="px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto grid max-w-[1280px] items-stretch gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-x-10">
          <div className="lg:pr-10 min-[1601px]:pr-20">
            <h2 className="font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:text-[48px] min-[1181px]:text-[56px]">
              <span className="text-[var(--lw-accent)]">{contactPage.infoHeading} </span>
              <span className="italic tracking-normal text-[var(--lw-primary)]">{contactPage.infoAccent}</span>
            </h2>
            <p className="mt-6 text-[14px] leading-[1.45] text-text-primary sm:text-[16px] min-[1181px]:text-[18px]">
              {contactPage.infoBody}
            </p>

            <h3 className="mt-10 font-body text-[12px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:text-[13px] min-[1181px]:text-[15px]">
              Email:
            </h3>
            <p className="mt-2">
              <a
                href={emailHref}
                className="text-[14px] leading-[1.45] text-text-primary no-underline hover:text-[var(--lw-primary)] sm:text-[16px] min-[1181px]:text-[18px]"
              >
                {email}
              </a>
            </p>

            <h3 className="mt-8 font-body text-[12px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:text-[13px] min-[1181px]:text-[15px]">
              Open:
            </h3>
            <div className="mt-2 space-y-1 text-[14px] leading-[1.45] text-text-primary sm:text-[16px] min-[1181px]:text-[18px]">
              {hours.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            <h3 className="mt-8 font-body text-[12px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:text-[13px] min-[1181px]:text-[15px]">
              Address:
            </h3>
            <address className="mt-2 not-italic text-[14px] leading-[1.45] text-text-primary sm:text-[16px] min-[1181px]:text-[18px]">
              <p>
                {street}
                <br />
                {cityLine}
              </p>
            </address>
          </div>

          <div className="min-h-[320px] overflow-hidden rounded-[20px] sm:min-h-[420px] lg:min-h-[520px]">
            <iframe
              title={`${street}, ${cityLine}`}
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-[320px] w-full border-0 sm:min-h-[420px] lg:min-h-[520px]"
            />
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-2 lg:gap-x-12">
          <div>
            <Image
              src={contactPage.formImage.src}
              alt={contactPage.formImage.alt}
              width={contactPage.formImage.width}
              height={contactPage.formImage.height}
              loading="lazy"
              sizes="(min-width: 1024px) 50vw, 92vw"
              className="h-[400px] w-full rounded-[20px] object-cover object-center sm:h-[600px] lg:h-[700px] lg:rounded-[30px]"
            />
          </div>
          <div>
            <h2 className="font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] text-[var(--lw-accent)] sm:text-[48px] min-[1181px]:text-[56px]">
              {contactPage.formHeading} {contactPage.formAccent}
            </h2>
            <p className="mt-6 text-[14px] leading-[1.45] text-text-primary sm:text-[16px] min-[1181px]:text-[18px]">
              {contactPage.formBody}
            </p>
            <div className="mt-8">
              <ContactForm variant="compact" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContactHero({
  phone,
  phoneHref,
  emailHref,
  smsHref,
  bookingUrl,
}: {
  phone: string;
  phoneHref: string;
  emailHref: string;
  smsHref: string;
  bookingUrl: string;
}) {
  return (
    <InnerPageHero
      image={contactPage.heroImage}
      imageSide="right"
      title={contactPage.headingLead}
      accent={contactPage.headingAccent}
      accentFirst
      lead={contactPage.lead}
    >
      <ul className="flex flex-wrap gap-[15px]">
        <li>
          <HeroAction href={phoneHref} variant="solid" icon="call">
            Call
          </HeroAction>
        </li>
        <li>
          <HeroAction href={smsHref} variant="ghost" icon="text" iconEnd>
            Text
          </HeroAction>
        </li>
        <li>
          <HeroAction href={emailHref} variant="ghost" icon="email" iconEnd>
            Email
          </HeroAction>
        </li>
      </ul>

      <div>
        <SwapButton href={bookingUrl}>Book an Appointment</SwapButton>
      </div>

      <a href={phoneHref} className="no-underline">
        <p className="font-body text-[11px] font-semibold uppercase tracking-[1px] text-text-primary sm:text-[12px] min-[1181px]:text-[13px]">
          Give Us a Call:
        </p>
        <p className="mt-1 font-heading text-[20px] font-medium italic leading-[1.3] tracking-[-1px] text-[var(--lw-primary)] transition-colors duration-300 hover:text-[#4A8F55] sm:text-[24px] min-[1181px]:text-[26px]">
          {phone}
        </p>
      </a>
    </InnerPageHero>
  );
}

function HeroAction({
  href,
  children,
  variant,
  icon,
  iconEnd,
}: {
  href: string;
  children: string;
  variant: 'solid' | 'ghost';
  icon: 'call' | 'text' | 'email';
  iconEnd?: boolean;
}) {
  const classes =
    variant === 'solid'
      ? 'inline-flex min-h-[51px] items-center gap-2.5 rounded-[30px] bg-[var(--lw-primary)] px-6 text-[16px] font-normal text-white no-underline transition-colors duration-300 hover:bg-transparent hover:text-[var(--lw-accent)] hover:ring-1 hover:ring-[var(--lw-accent)] min-[1181px]:text-[18px]'
      : 'inline-flex min-h-[51px] items-center gap-2.5 rounded-[30px] border border-[var(--lw-primary)] bg-transparent px-6 text-[16px] font-normal text-text-primary no-underline transition-colors duration-300 hover:border-[var(--lw-accent)] hover:bg-[var(--lw-accent)] hover:text-white min-[1181px]:text-[18px]';

  const glyph = <ActionIcon name={icon} />;

  return (
    <a href={href} className={classes}>
      {!iconEnd && glyph}
      <span>{children}</span>
      {iconEnd && glyph}
    </a>
  );
}

function ActionIcon({ name }: { name: 'call' | 'text' | 'email' }) {
  const common = {
    'aria-hidden': true as const,
    focusable: 'false' as const,
    width: 16,
    height: 16,
    fill: 'currentColor',
  };

  if (name === 'call') {
    return (
      <svg {...common} viewBox="0 0 24 24">
        <path d="M6.6 10.8c1.4 2.7 3.9 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.9z" />
      </svg>
    );
  }
  if (name === 'text') {
    return (
      <svg {...common} viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
      </svg>
    );
  }
  return (
    <svg {...common} viewBox="0 0 24 24">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}
