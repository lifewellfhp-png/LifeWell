import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function authorized(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return true;
  const header = req.headers.get('x-revalidate-secret');
  const url = new URL(req.url);
  return header === secret || url.searchParams.get('secret') === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  // Tag-based invalidation is the primary mechanism: src/lib/cms.ts's
  // fetchPublicCms()/fetchPublicBlogPost() are called from many different
  // routes (home, services, fees-insurance, telehealth states, blog
  // index/detail, sitemap, ...), each getting its own Data Cache entry per
  // URL. revalidatePath() only invalidates the Full Route Cache for the
  // path(s) named below — it does not reliably reach a fetch's Data Cache
  // entry when that fetch happens in a route not named here. Tagging every
  // CMS fetch with cms-content/cms-blog (see cms.ts) and revalidating those
  // tags purges the underlying data everywhere it's used, regardless of
  // which routes call it.
  revalidateTag('cms-content');
  revalidateTag('cms-blog');
  // Kept alongside the tags above as defense-in-depth for the specific
  // routes most likely to be visited right after a save.
  revalidatePath('/', 'layout');
  revalidatePath('/blog', 'page');
  revalidatePath('/blog/[slug]', 'page');
  return NextResponse.json({ success: true });
}

export async function GET(req: Request) {
  return POST(req);
}
