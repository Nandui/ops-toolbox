import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken, verifySession } from '@/lib/auth'
import { getSql } from '@/lib/db'

export async function GET(request: NextRequest) {
  const token = readSessionToken(request)
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const user = await verifySession(token)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sql = await getSql()
  const users = await sql`SELECT id, email, name, role, site_ids, active, last_login_at, created_at FROM users ORDER BY id`
  return NextResponse.json(users)
}