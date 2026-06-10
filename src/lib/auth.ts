import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import * as bcrypt from 'bcryptjs'
import { type UserRole } from './portal'
import { getSql } from './db'

/**
 * Shared auth/session primitives for the portal.
 *
 * Keep all cookie names, JWT shape, and role handling here so API routes,
 * client hydration, and middleware/proxy logic stay consistent.
 */
export const SESSION_COOKIE_NAME = 'lw_session'
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export interface SessionUser {
  id: number
  email: string
  name: string
  role: UserRole
  siteIds: number[]
}

interface CookieHeaderLike {
  get(name: string): string | null
}

interface CookieStoreLike {
  get(name: string): { value: string } | undefined
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'lw-portal-dev-secret'
  return new TextEncoder().encode(secret)
}

export function readSessionToken(request: { cookies: CookieStoreLike }): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
}

export function shouldUseSecureCookies(request: { headers: CookieHeaderLike }): boolean {
  const explicit = process.env.COOKIE_SECURE?.toLowerCase()
  if (explicit === 'true') return true
  if (explicit === 'false') return false
  return request.headers.get('x-forwarded-proto') === 'https'
}

export function buildSessionCookieOptions(request: { headers: CookieHeaderLike }) {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: 'lax' as const,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  }
}

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret())
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function requireAuth(allowedRoles?: UserRole[]): Promise<SessionUser> {
  const user = await getSession()
  if (!user) redirect('/login')
  if (allowedRoles && !allowedRoles.includes(user.role)) redirect('/dashboard')
  return user
}

export async function loginUser(email: string, password: string): Promise<SessionUser | null> {
  const sql = await getSql()
  const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()} AND active = 1` as {
    id: number; email: string; name: string; password_hash: string; role: UserRole; site_ids: string
  }[]
  const row = rows[0]

  if (!row) {
    console.error('[login] user not found:', email.toLowerCase())
    return null
  }
  const valid = bcrypt.compareSync(password, row.password_hash)
  if (!valid) {
    console.error('[login] password mismatch for:', email.toLowerCase())
    return null
  }

  await sql`UPDATE users SET last_login_at = now() WHERE id = ${row.id}`

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    siteIds: JSON.parse(row.site_ids),
  }
}

export function getUserSiteIds(user: SessionUser): number[] | null {
  if (user.role === 'admin' || user.role === 'operations_manager') return null
  return user.siteIds
}
