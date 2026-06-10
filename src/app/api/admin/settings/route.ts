import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken, verifySession } from '@/lib/auth'
import { getSql } from '@/lib/db'
import fs from 'fs'
import path from 'path'

// Maps DB setting keys to the env var name written to .env.local for persistence across restarts
const ENV_VAR_MAP: Record<string, string> = {
  notion_api_key: 'NOTION_API_KEY',
}

function persistToEnvLocal(key: string, value: string) {
  const envKey = ENV_VAR_MAP[key]
  if (!envKey) return
  const envPath = path.join(process.cwd(), '.env.local')
  let lines: string[] = []
  try {
    lines = fs.readFileSync(envPath, 'utf8').split('\n')
  } catch {
    // file doesn't exist yet
  }
  const newLine = `${envKey}=${JSON.stringify(value)}`
  const idx = lines.findIndex(l => l.startsWith(`${envKey}=`))
  if (idx >= 0) {
    lines[idx] = newLine
  } else {
    lines.push(newLine)
  }
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8')
}

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

  const sql = await getSql()
  const rows = await sql`SELECT key, value, updated_at FROM system_settings ORDER BY key` as { key: string; value: string; updated_at: string }[]
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

  const sql = await getSql()
  await sql`
    INSERT INTO system_settings (key, value, updated_at) VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`
  persistToEnvLocal(key, value)
  return NextResponse.json({ ok: true })
}