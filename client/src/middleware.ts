import { NextResponse, type NextRequest } from 'next/server';

import { englishPathForSpanishPath } from '@/lib/spanish-redirects';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname !== '/es' && !pathname.startsWith('/es/')) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = englishPathForSpanishPath(pathname);
  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: ['/es', '/es/:path*'],
};
