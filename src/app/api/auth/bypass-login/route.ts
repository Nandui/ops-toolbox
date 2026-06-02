import { NextRequest, NextResponse } from 'next/server'
import { buildSessionCookieOptions, createSession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { getDb } from '@/lib/db'
import type { UserRole } from '@/lib/portal'

export async function POST(request: NextRequest) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE role = ? AND active = 1 LIMIT 1').get('admin') as {
    id: number; email: string; name: string; role: UserRole; site_ids: string
  } | undefined

  if (!row) {
    return NextResponse.json({ error: 'No admin user found' }, { status: 404 })
  }

  const user = { id: row.id, email: row.email, name: row.name, role: row.role, siteIds: JSON.parse(row.site_ids) }
  const token = await createSession(user)

  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(request))
  return response
}
