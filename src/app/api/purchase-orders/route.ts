import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listPoRequests, createPoRequest, savePoFile } from '@/lib/notion-po'
import type { PoSite, PoUrgency } from '@/lib/notion-po'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  try {
    const pos = await listPoRequests()
    // Non-admin users only see their own submissions
    const filtered = session.role === 'admin' || session.role === 'operations_manager'
      ? pos
      : pos.filter(p => p.requestedBy === session.name)
    return NextResponse.json({ purchaseOrders: filtered })
  } catch (err) {
    console.error('PO list error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  try {
    const form = await request.formData()

    const description = (form.get('description') as string | null)?.trim()
    const site        = form.get('site') as PoSite | null
    const supplier    = (form.get('supplier') as string | null)?.trim()
    const urgency     = form.get('urgency') as PoUrgency | null
    const valueStr    = form.get('value') as string | null
    const file        = form.get('quote') as File | null

    if (!description || !site || !supplier || !urgency || !valueStr) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const value = parseFloat(valueStr)
    if (isNaN(value) || value <= 0) {
      return NextResponse.json({ error: 'Value must be a positive number' }, { status: 400 })
    }

    let quoteFilename: string | null = null
    let fileBuffer: Buffer | null = null
    let fileContentType = 'application/octet-stream'

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'Quote file must be under 10 MB' }, { status: 400 })
      }
      fileBuffer = Buffer.from(await file.arrayBuffer())
      quoteFilename = file.name
      fileContentType = file.type || 'application/octet-stream'
    }

    const po = await createPoRequest({
      description,
      site,
      value,
      supplier,
      urgency,
      requestedBy: session.name,
      quoteFilename,
    })

    if (fileBuffer && quoteFilename) {
      await savePoFile(po.id, quoteFilename, fileContentType, fileBuffer)
    }

    return NextResponse.json({ purchaseOrder: po }, { status: 201 })
  } catch (err) {
    console.error('PO create error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
