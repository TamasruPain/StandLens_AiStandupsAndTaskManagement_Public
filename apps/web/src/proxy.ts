import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check for BetterAuth session cookie
  const sessionToken =
    request.cookies.get('better-auth.session_token') ||
    request.cookies.get('__Secure-better-auth.session_token');

  const isAuthenticated = !!sessionToken;

  const isProtectedPath =
    path.startsWith('/dashboard') ||
    path.startsWith('/teams') ||
    path.startsWith('/digests') ||
    path.startsWith('/standups') ||
    path.startsWith('/settings');

  const isAuthPath = path === '/login' || path === '/register';

  if (isProtectedPath && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPath && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/teams/:path*',
    '/digests/:path*',
    '/standups/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
};
