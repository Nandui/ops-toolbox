import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updatePoRequest } from '@/lib/notion/purchase-orders'
import type { PoStatus } from '@/lib/notion/purchase-orders'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { status, poNumber, adminNotes } = await request.json() as {
    status: PoStatus
    poNumber?: string
    adminNotes?: string
  }

  try {
    const po = await updatePoRequest(id, { status, poNumber, adminNotes })
    return NextResponse.json({ purchaseOrder: po })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
