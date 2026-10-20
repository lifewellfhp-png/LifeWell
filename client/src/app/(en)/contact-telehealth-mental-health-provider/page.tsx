import type { Metadata } from 'next';

import { ContactPageContent } from '@/components/sections/ContactPageContent';
import { JsonLd } from '@/components/seo/JsonLd';
import { contactPage } from '@/data/contact';
import { site } from '@/data/site';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Reach out today to contact a telehealth mental health provider, schedule your appointment, or ask questions about services, fees, and insurance options.';

const PATH = '/contact-telehealth-mental-health-provider';

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Contact Us — Secure, Confidential Telehealth Support',
    description: DESCRIPTION,
    path: PATH,
    image: {
      url: contactPage.heroImage.src,
      width: contactPage.heroImage.width,
      height: contactPage.heroImage.height,
      alt: contactPage.heroImage.alt,
    },
  });
}

export default async function ContactPage() {
  const cms = await getResolvedContent();
  const loc = cms.locations.find((row) => row.isPrimary) ?? cms.locations[0];
  const phone = cms.settings.practicePhone || loc?.phone || site.contact.phone;
  const email = cms.settings.practiceEmail || loc?.email || site.contact.email;
  const street = loc?.street || site.address.street;
  const cityLine = loc
    ? [loc.city, loc.region, loc.postalCode].filter(Boolean).join(', ')
    : `${site.address.city}, ${site.address.state} ${site.address.zip}`;
  const mapQuery = loc?.address || `${street}, ${cityLine}`;

  return (
    <>
      <JsonLd
        data={pageGraph(PATH, 'Contact Us', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'Contact Us', href: PATH },
        ])}
        id="contact-schema"
      />
      <ContactPageContent
        contact={{
          phone,
          email,
          hours: loc?.hours?.length ? loc.hours : contactPage.hours,
          street,
          cityLine,
          mapSrc: `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`,
          bookingUrl: cms.booking.page,
        }}
      />
    </>
  );
}
