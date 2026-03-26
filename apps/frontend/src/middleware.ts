import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
});

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip auth logic for static files and api
  if (
    pathname.includes('.') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token');
  const refreshToken = request.cookies.get('refresh_token');

  const protectedPaths = ['/chat', '/profile', '/settings', '/friends'];
  const authPaths = ['/login', '/signup', '/verify-email'];

  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  if (pathname === '/' || pathname === '/en') {
    if (accessToken || refreshToken) {
      return NextResponse.redirect(new URL('/friends', request.url));
    }
  }

  if (isProtectedPath && !accessToken && !refreshToken) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPath && (accessToken || refreshToken)) {
    return NextResponse.redirect(new URL('/friends', request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Enable a redirect to a matching locale at the root
    '/',

    // Set a cookie to remember the last locale for these paths
    '/(en)/:path*',

    // Match all pathnames except for
    // - /api (API routes)
    // - /_next (Next.js internals)
    // - /_vercel (Vercel internals)
    // - /static (Static files)
    // - /.* (File extensions, e.g. /favicon.ico)
    '/((?!api|_next|_vercel|static|.*\\..*).*)'
  ],
};
