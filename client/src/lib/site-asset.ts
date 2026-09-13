/**
 * Whether a src can safely go through next/image. True for local/relative
 * paths and for Supabase Storage's public bucket (the only remote host
 * configured in next.config.ts's images.remotePatterns — admin-uploaded CMS
 * media lands there). Any other external host falls back to a plain <img>,
 * since next/image throws for an unconfigured remote host.
 */
export function isOptimizableImageSrc(src: string): boolean {
  if (!src) return false;
  if (!/^https?:\/\//i.test(src)) return true;
  try {
    const { hostname, pathname } = new URL(src);
    return /\.supabase\.co$/i.test(hostname) && pathname.startsWith('/storage/v1/object/public/');
  } catch {
    return false;
  }
}

/**
 * Bundled photos live on the Next.js app (`/images/...`).
 * www.lifewellfhp.com is still WordPress, so absolute www URLs 404.
 * Keep Supabase (and other remote) URLs unchanged.
 */
export function siteAssetSrc(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  try {
    const parsed = new URL(trimmed);
    const bundled =
      parsed.pathname.startsWith('/images/') ||
      parsed.pathname.startsWith('/video/') ||
      parsed.pathname.startsWith('/fonts/');
    if (
      bundled &&
      (/(^|\.)lifewellfhp\.com$/i.test(parsed.hostname) ||
        /lifewellfhp-client\.vercel\.app$/i.test(parsed.hostname))
    ) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}
