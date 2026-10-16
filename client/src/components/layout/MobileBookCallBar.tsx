import { getResolvedContent } from '@/lib/cms-resolve';
import { site } from '@/data/site';
import { MobileBookCallBarClient } from './MobileBookCallBarClient';

/**
 * Sticky mobile "Book / Call" bar (Phase 23 premium redesign). Mirrors
 * SiteHeader's own server-wrapper-fetches-CMS, client-component-renders
 * pattern — phone/booking URL are admin-editable, so this reads the same
 * resolved content Header/Footer already do rather than hardcoding either.
 */
export async function MobileBookCallBar() {
  const cms = await getResolvedContent();
  const phone =
    cms.settings.practicePhone || cms.locations.find((row) => row.isPrimary)?.phone || cms.locations[0]?.phone || site.contact.phone;
  const bookingHref = cms.booking.page || site.booking.page;
  const bookingLabel = cms.booking.label || site.booking.label;

  return <MobileBookCallBarClient phone={phone} bookingHref={bookingHref} bookingLabel={bookingLabel} />;
}
