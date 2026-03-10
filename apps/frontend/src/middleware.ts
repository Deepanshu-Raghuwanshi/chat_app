import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token');
  const refreshToken = request.cookies.get('refresh_token');

  const protectedPaths = ['/chat', '/profile', '/settings'];
  const authPaths = ['/login', '/signup', '/verify-email'];

  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath && !accessToken && !refreshToken) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPath && (accessToken || refreshToken)) {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/login',
    '/signup',
    '/verify-email',
  ],
};
