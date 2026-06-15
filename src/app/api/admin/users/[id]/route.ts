import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { readSessionToken, verifySession } from '@/lib/auth'
import { getSql } from '@/lib/db'
import { USER_ROLES } from '@/lib/portal'

type UserRow = {
  id: number; email: string; name: string; password_hash: string
  role: string; site_ids: string; active: number
  last_login_at: string | null; created_at: string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = readSessionToken(request)
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const session = await verifySession(token)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })

  const body = await request.json() as {
    name?: string
    email?: string
    role?: string
    password?: string
    siteIds?: number[]
    active?: boolean
  }

  if (body.role !== undefined && !(USER_ROLES as readonly string[]).includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (body.password !== undefined && body.password !== '' && body.password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const sql = await getSql()
  const existing = await sql`SELECT * FROM users WHERE id = ${userId}` as UserRow[]
  if (!existing[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const current = existing[0]

  const newName         = body.name?.trim()              ?? current.name
  const newEmail        = body.email?.toLowerCase().trim() ?? current.email
  const newRole         = body.role                      ?? current.role
  const newSiteIds      = body.siteIds !== undefined ? JSON.stringify(body.siteIds) : current.site_ids
  const newActive       = body.active  !== undefined ? (body.active ? 1 : 0) : current.active
  const newPasswordHash = body.password
    ? bcrypt.hashSync(body.password, 12)
    : current.password_hash

  // Check email uniqueness if changing
  if (newEmail !== current.email) {
    const clash = await sql`SELECT id FROM users WHERE email = ${newEmail} AND id != ${userId}` as { id: number }[]
    if (clash.length > 0) return NextResponse.json({ error: 'Email is already in use' }, { status: 409 })
  }

  const rows = await sql`
    UPDATE users SET
      name          = ${newName},
      email         = ${newEmail},
      role          = ${newRole},
      site_ids      = ${newSiteIds},
      active        = ${newActive},
      password_hash = ${newPasswordHash}
    WHERE id = ${userId}
    RETURNING id, email, name, role, site_ids, active, last_login_at, created_at
  ` as Record<string, unknown>[]

  return NextResponse.json(rows[0])
}
