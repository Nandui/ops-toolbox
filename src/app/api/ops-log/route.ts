import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken, verifySession } from '@/lib/auth'
import { getDb } from '@/lib/db'

async function auth(request: NextRequest) {
  const token = readSessionToken(request)
  if (!token) return null
  return verifySession(token)
}

export async function GET(request: NextRequest) {
  const user = await auth(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const date = searchParams.get('date')
  const siteId = Number(searchParams.get('siteId'))
  if (!date || !siteId) return NextResponse.json({ error: 'date and siteId required' }, { status: 400 })

  const row = getDb().prepare(
    'SELECT data, updated_by, updated_at FROM ops_logs WHERE site_id = ? AND log_date = ?'
  ).get(siteId, date) as { data: string; updated_by: string | null; updated_at: string } | undefined

  if (!row) return NextResponse.json({ log: null })
  return NextResponse.json({ log: JSON.parse(row.data), updatedBy: row.updated_by, updatedAt: row.updated_at })
}

export async function PUT(request: NextRequest) {
  const user = await auth(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { date, siteId, data } = await request.json()
  if (!date || !siteId || !data) return NextResponse.json({ error: 'date, siteId, data required' }, { status: 400 })

  getDb().prepare(`
    INSERT INTO ops_logs (site_id, log_date, data, updated_by, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(site_id, log_date)
    DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = datetime('now')
  `).run(siteId, date, JSON.stringify(data), user.name)

  return NextResponse.json({ ok: true })
}
