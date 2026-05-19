import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken, verifySession } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const token = readSessionToken(request)
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const user = await verifySession(token)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = getDb()
  const settings = db.prepare('SELECT key, value, updated_at FROM system_settings ORDER BY key').all()
  return NextResponse.json(settings)
}