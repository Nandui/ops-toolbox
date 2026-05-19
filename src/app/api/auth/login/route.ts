import { NextRequest, NextResponse } from 'next/server'
import { buildSessionCookieOptions, createSession, SESSION_COOKIE_NAME, loginUser } from '@/lib/auth'

/**
 * Build a redirect URL using the client-facing host (from Host or X-Forwarded-Host header)
 * instead of the server's own request.url which resolves to localhost.
 */
function buildRedirectUrl(request: NextRequest, path: string): URL {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host') || 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  return new URL(path, `${protocol}://${host}`)
}



export async function POST(request: NextRequest) {
  try {
    // Support both JSON (JS fetch) and form-encoded (native form POST) requests
    const contentType = request.headers.get('content-type') || ''
    let email: string, password: string

    if (contentType.includes('application/json')) {
      const body = await request.json()
      email = body.email
      password = body.password
    } else {
      // Form-encoded submission (progressive enhancement fallback)
      const formData = await request.formData()
      email = formData.get('email') as string
      password = formData.get('password') as string
    }

    if (!email || !password) {
      // For form submissions, redirect back with error
      if (!contentType.includes('application/json')) {
        return NextResponse.redirect(buildRedirectUrl(request, '/login?error=missing'))
      }
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const user = await loginUser(email, password)
    if (!user) {
      if (!contentType.includes('application/json')) {
        return NextResponse.redirect(buildRedirectUrl(request, '/login?error=invalid'))
      }
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = await createSession(user)

    if (!contentType.includes('application/json')) {
      // Form submission: set cookie and redirect to dashboard
      const response = NextResponse.redirect(buildRedirectUrl(request, '/dashboard'))
      response.cookies.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(request))
      return response
    }

    // JSON submission: return JSON with cookie
    const response = NextResponse.json({ success: true, user: { name: user.name, role: user.role } })
    response.cookies.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(request))
    return response
  } catch (err) {
    console.error('Login error:', err)
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return NextResponse.redirect(buildRedirectUrl(request, '/login?error=server'))
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}