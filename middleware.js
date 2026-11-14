import { NextResponse } from 'next/server'

// Edge runtime: no database, no bcrypt. This only checks that a session cookie EXISTS.
// The real check (is it valid and not expired?) is getCurrentMerchant() in the portal
// layout and in every route.
export function middleware(request) {
  if (!request.cookies.get('portal_session')?.value) {
    // API callers (the assistant's fetch, /api/v1) must get a plain 401 JSON, not the login page.
    const path = request.nextUrl.pathname
    if (path === '/api/assistant') {
      return NextResponse.json({ error: 'signed_out' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (path === '/api' || path.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'signed_out', message: 'Please log in first. This API uses your portal session.' } },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
      )
    }
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
