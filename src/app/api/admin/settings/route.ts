import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken, verifySession } from '@/lib/auth'
import { getDb } from '@/lib/db'

const SENSITIVE_KEYS = new Set(['notion_api_key'])

async function requireAdmin(request: NextRequest) {
  const token = readSessionToken(request)
  if (!token) return null
  const user = await verifySession(token)
  return user?.role === 'admin' ? user : null
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = getDb()
  const rows = db.prepare('SELECT key, value, updated_at FROM system_settings ORDER BY key').all() as { key: string; value: string; updated_at: string }[]
  const settings = rows.map(r => ({
    ...r,
    value: SENSITIVE_KEYS.has(r.key) ? '••••••••' : r.value,
    configured: SENSITIVE_KEYS.has(r.key) ? !!r.value : undefined,
  }))
  return NextResponse.json(settings)
}

const EDITABLE_KEYS = new Set(['notion_api_key'])

export async function PATCH(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const { key, value } = body ?? {}
  if (typeof key !== 'string' || typeof value !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  if (!EDITABLE_KEYS.has(key)) {
    return NextResponse.json({ error: 'Setting is not editable via the API' }, { status: 400 })
  }

  const db = getDb()
  db.prepare(`INSERT OR REPLACE INTO system_settings (key, value, updated_at)
              VALUES (?, ?, datetime('now'))`).run(key, value)
  return NextResponse.json({ ok: true })
}