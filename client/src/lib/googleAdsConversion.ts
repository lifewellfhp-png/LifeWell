/**
 * The one seam that touches `window.gtag`. Google Ads conversion tracking
 * only — no GTM container, no GA4, no enhanced conversions/user_data. The
 * matching loader (gtag.js + the `gtag('config', ...)` call) lives in
 * app/layout.tsx and renders only on the public site, never in admin/ or
 * inside the cross-origin CharmHealth booking iframe.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type GoogleAdsConversionType = 'contact' | 'phone_click' | 'booking_click';

const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? '';

const CONVERSION_LABELS: Record<GoogleAdsConversionType, string> = {
  contact: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_CONTACT ?? '',
  phone_click: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_PHONE_CLICK ?? '',
  booking_click: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_BOOKING_CLICK ?? '',
};

/**
 * No-ops silently whenever the tag isn't loaded or this event type has no
 * label configured yet, so a missing/partial Ads setup never breaks the
 * underlying first-party beacon this is layered on top of. Sends only
 * `send_to` — no form fields, PII, transaction_id, or value.
 */
export function fireGoogleAdsConversion(type: GoogleAdsConversionType): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  if (!GOOGLE_ADS_ID) return;
  const label = CONVERSION_LABELS[type];
  if (!label) return;
  window.gtag('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${label}` });
}
