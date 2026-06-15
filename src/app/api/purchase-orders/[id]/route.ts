import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getPoRequest, updatePoRequest, generatePoNumber, getPoFile } from '@/lib/notion-po'
import type { PoStatus } from '@/lib/notion-po'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const po = await getPoRequest(id)
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.role !== 'admin' && session.role !== 'operations_manager' && po.requestedBy !== session.name) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ purchaseOrder: po })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const po = await getPoRequest(id)
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as { status?: PoStatus; adminNotes?: string }
  const { status, adminNotes } = body

  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })

  let poNumber: string | undefined
  if (status === 'Approved' && !po.poNumber) {
    poNumber = await generatePoNumber(po.site)
  }

  const updated = await updatePoRequest(id, { status, poNumber, adminNotes })
  return NextResponse.json({ purchaseOrder: updated })
}

// Quote file download
export async function HEAD(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return new NextResponse(null, { status: 401 })
  const { id } = await params
  const file = await getPoFile(id)
  if (!file) return new NextResponse(null, { status: 404 })
  return new NextResponse(null, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': String(file.data.length),
    },
  })
}
