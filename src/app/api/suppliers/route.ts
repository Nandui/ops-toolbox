import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSql } from '@/lib/db'

type SupplierRow = { id: number; name: string; active: boolean; created_at: string }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const sql = await getSql()
  const rows = await sql`SELECT id, name, active, created_at FROM suppliers WHERE active = true ORDER BY name` as SupplierRow[]
  return NextResponse.json({ suppliers: rows })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name } = await request.json() as { name?: string }
  const trimmed = name?.trim()
  if (!trimmed) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const sql = await getSql()
  try {
    const rows = await sql`
      INSERT INTO suppliers (name) VALUES (${trimmed})
      ON CONFLICT (name) DO UPDATE SET active = true
      RETURNING id, name, active, created_at` as SupplierRow[]
    return NextResponse.json({ supplier: rows[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
