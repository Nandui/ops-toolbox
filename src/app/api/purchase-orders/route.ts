import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listPoRequests, createPoRequest } from '@/lib/notion/purchase-orders'
import type { PoSite, PoUrgency } from '@/lib/notion/purchase-orders'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  try {
    const all = await listPoRequests()
    const pos = session.role === 'admin'
      ? all
      : all.filter(p => p.requestedBy === session.name)
    return NextResponse.json({ purchaseOrders: pos })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

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

    if (!description || !site || !supplier || !urgency || !valueStr) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const value = parseFloat(valueStr)
    if (isNaN(value) || value <= 0) {
      return NextResponse.json({ error: 'Value must be a positive number' }, { status: 400 })
    }

    const po = await createPoRequest({ description, site, supplier, urgency, value, requestedBy: session.name })
    return NextResponse.json({ purchaseOrder: po }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
