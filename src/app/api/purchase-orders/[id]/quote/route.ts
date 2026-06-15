import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getPoFile, getPoRequest } from '@/lib/notion-po'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return new NextResponse('Unauthorised', { status: 401 })

  const { id } = await params

  // Check PO exists and user has access
  const po = await getPoRequest(id)
  if (!po) return new NextResponse('Not found', { status: 404 })
  if (session.role !== 'admin' && session.role !== 'operations_manager' && po.requestedBy !== session.name) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const file = await getPoFile(id)
  if (!file) return new NextResponse('No file attached', { status: 404 })

  return new NextResponse(file.data, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `inline; filename="${file.filename}"`,
      'Content-Length': String(file.data.length),
    },
  })
}
