import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSql } from '@/lib/db'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const sql = await getSql()
  await sql`UPDATE suppliers SET active = false WHERE id = ${Number(id)}`
  return NextResponse.json({ ok: true })
}
