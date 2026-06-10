import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken, verifySession } from '@/lib/auth'
import { getSql } from '@/lib/db'

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

  const sql = await getSql()
  const rows = await sql`
    SELECT data, created_by, updated_by, updated_at
    FROM dept_plans WHERE site_id = ${siteId} AND plan_date = ${date}` as {
    data: unknown; created_by: string; updated_by: string; updated_at: string
  }[]

  if (!rows[0]) return NextResponse.json({ plan: null })

  return NextResponse.json({
    plan: rows[0].data,
    createdBy: rows[0].created_by,
    updatedBy: rows[0].updated_by,
    updatedAt: rows[0].updated_at,
  })
}

export async function PUT(request: NextRequest) {
  const user = await auth(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { date, siteId, data } = body as { date: string; siteId: number; data: unknown }
  if (!date || !siteId || !data) return NextResponse.json({ error: 'date, siteId, data required' }, { status: 400 })

  const sql = await getSql()
  await sql`
    INSERT INTO dept_plans (site_id, plan_date, data, created_by, updated_by, updated_at)
    VALUES (${siteId}, ${date}, ${JSON.stringify(data)}::jsonb, ${user.name}, ${user.name}, now())
    ON CONFLICT (site_id, plan_date) DO UPDATE SET
      data = EXCLUDED.data,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()`

  const saved = await sql`
    SELECT updated_by, updated_at FROM dept_plans
    WHERE site_id = ${siteId} AND plan_date = ${date}` as { updated_by: string; updated_at: string }[]

  return NextResponse.json({
    ok: true,
    updatedBy: saved[0]?.updated_by ?? user.name,
    updatedAt: saved[0]?.updated_at ?? new Date().toISOString(),
  })
}
