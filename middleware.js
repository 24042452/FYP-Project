import { NextResponse } from 'next/server'

// Edge runtime: no database, no bcrypt. This only checks that a session cookie EXISTS.
// The real check (is it valid and not expired?) is getCurrentMerchant() in the portal
// layout and in every route.
export function middleware(request) {
  if (!request.cookies.get('portal_session')?.value) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  // Logged-in portal pages must never be stored, so the back button after sign-out shows nothing.
  const res = NextResponse.next()
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}

export const config = {
  // Everything except the login page, Next.js internals and files with an extension.
  matcher: ['/((?!login|_next/|favicon\\.ico|.*\\..*).*)'],
}
