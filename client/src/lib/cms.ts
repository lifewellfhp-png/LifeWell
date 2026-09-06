/**
 * Public CMS client — fetches published content from the API.
 * Falls back to null when the CMS is empty/unconfigured so static data remains.
 */
import { unstable_noStore as noStore } from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lifewellfhp-server.vercel.app';

export type PublicCmsPayload = {
  announcements: unknown[];
  services: unknown[];
  providers: unknown[];
  insurance: unknown[];
  testimonials: unknown[];
  faqs: unknown[];
  locations: unknown[];
  telehealthStates: unknown[];
  posts: unknown[];
  videos: unknown[];
  sections: unknown[];
  booking: unknown[];
  seo: unknown[];
  settings: Record<string, unknown> | null;
};

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPublicCms(): Promise<PublicCmsPayload | null> {
  noStore();
  const url = `${API_URL}/api/public/content?ts=${Date.now()}`;
  const init: RequestInit = {
    cache: 'no-store',
    next: { revalidate: 0 },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init);
      if (!res.ok) continue;
      const json = (await res.json()) as { success: boolean; data: PublicCmsPayload | null };
      if (json.success && json.data) return json.data;
    } catch {
      // Retry once — serverless cold starts can time out on the first attempt.
    }
  }
  return null;
}

export async function fetchPublicBlogPost(slug: string): Promise<Record<string, unknown> | null> {
  noStore();
  const url = `${API_URL}/api/public/blog/${encodeURIComponent(slug)}?ts=${Date.now()}`;
  const init: RequestInit = {
    cache: 'no-store',
    next: { revalidate: 0 },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init);
      if (!res.ok) continue;
      const json = (await res.json()) as { success: boolean; data: Record<string, unknown> | null };
      if (json.success && json.data) return json.data;
    } catch {
      // Retry once on transient network failure.
    }
  }
  return null;
}

export type DeviceCategory = 'mobile' | 'tablet' | 'desktop' | 'unknown';

/**
 * Coarse, privacy-safe device classification by viewport width — no
 * user-agent parsing, no browser fingerprinting. Shared by trackPageView and
 * trackConversion (Phase 8 P3-1) so the two event types can never classify
 * device differently for the same visit.
 */
export function classifyDevice(): DeviceCategory {
  if (typeof window === 'undefined') return 'unknown';
  if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet';
  return 'desktop';
}

/**
 * Extracts a bare hostname from document.referrer for conversion events
 * (Phase 8 P3-1). Deliberately stricter than trackPageView's own inline
 * referrer capture below: http(s) only, and `.hostname` (never `.host`, so
 * a nonstandard port is never even sent) — matching the P3-1 task's explicit
 * "never retain ports" / "reject non-HTTP(S)" rules. trackPageView's
 * existing capture is left exactly as it already ships (not part of this
 * task's scope, no regression risk to already-shipped page-view analytics);
 * this is a new, separate, more conservative extraction used only for
 * conversions. The server independently re-validates whatever is sent here
 * regardless (see server/src/lib/attribution.ts) — this is a best-effort
 * clean value, not the trust boundary.
 */
export function extractReferrerHost(): string | null {
  if (typeof document === 'undefined' || !document.referrer) return null;
  if (!/^https?:\/\//i.test(document.referrer)) return null;
  try {
    return new URL(document.referrer).hostname || null;
  } catch {
    return null;
  }
}

export async function trackPageView(path: string): Promise<void> {
  try {
    const device = classifyDevice();

    let referrer_host: string | null = null;
    try {
      referrer_host = document.referrer ? new URL(document.referrer).host : null;
    } catch {
      referrer_host = null;
    }

    await fetch(`${API_URL}/api/public/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'page_view',
        path,
        referrer_host,
        device,
      }),
      keepalive: true,
    });
  } catch {
    // Telemetry must never break the page.
  }
}

export async function trackConversion(
  conversion_type: 'contact' | 'newsletter' | 'booking_click',
  path?: string
): Promise<void> {
  try {
    await fetch(`${API_URL}/api/public/conversions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversion_type,
        path: path ?? null,
        meta: {},
        device: classifyDevice(),
        referrer_host: extractReferrerHost(),
      }),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}
