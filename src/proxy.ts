import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/me']

/**
 * Build a redirect URL using the client-facing host instead of the server's
 * own request.url (which resolves to localhost when accessed externally).
 */
function buildRedirectUrl(request: NextRequest, path: string): URL {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host') || 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  return new URL(path, `${protocol}://${host}`)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through without auth check
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Only protect dashboard and API routes (excluding auth routes)
  if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check for session cookie
  const token = readSessionToken(request)
  if (!token) {
    return NextResponse.redirect(buildRedirectUrl(request, '/login'))
  }

  // Cookie exists — let the request through.
  // Full JWT verification + role checks happen in the API routes themselves.
  return NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  })
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/((?!auth).*)'],
}