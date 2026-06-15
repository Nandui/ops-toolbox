import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { readSessionToken, verifySession } from '@/lib/auth'
import { getSql } from '@/lib/db'
import { USER_ROLES } from '@/lib/portal'

export async function GET(request: NextRequest) {
  const token = readSessionToken(request)
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const session = await verifySession(token)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sql = await getSql()
  const users = await sql`SELECT id, email, name, role, site_ids, active, last_login_at, created_at FROM users ORDER BY id`
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const token = readSessionToken(request)
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const session = await verifySession(token)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, email, role, password, siteIds = [], active = true } = await request.json() as {
    name: string
    email: string
    role: string
    password: string
    siteIds?: number[]
    active?: boolean
  }

  if (!name?.trim() || !email?.trim() || !role || !password) {
    return NextResponse.json({ error: 'Name, email, role, and password are required' }, { status: 400 })
  }
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const sql = await getSql()

  const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase().trim()}` as { id: number }[]
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email is already in use' }, { status: 409 })
  }

  const passwordHash = bcrypt.hashSync(password, 12)
  const rows = await sql`
    INSERT INTO users (email, name, password_hash, role, site_ids, active)
    VALUES (
      ${email.toLowerCase().trim()},
      ${name.trim()},
      ${passwordHash},
      ${role},
      ${JSON.stringify(siteIds)},
      ${active ? 1 : 0}
    )
    RETURNING id, email, name, role, site_ids, active, last_login_at, created_at
  ` as Record<string, unknown>[]

  return NextResponse.json(rows[0], { status: 201 })
}
