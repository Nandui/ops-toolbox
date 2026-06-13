import { NextResponse } from 'next/server'
import { fetchAllTaskInstances } from '@/lib/trail/client'
import { getCachedJson, setCachedJson, todayIso, daysAgoIso } from '@/lib/trail/cache'

// Pending-approval tasks can be from any template and any recent date, so we
// fetch across the last 14 days with no template filter and return only the
// ones Trail has flagged as awaiting sign-off.
//
// Trail uses camelCase statuses (completed, completedLate, inProgress, overdue)
// so "pending approval" is expected as "pendingApproval".

function isPendingApproval(status: string) {
  const n = (status || '').toLowerCase()
  // catches: pendingApproval, pending_approval, "Pending Approval", etc.
  return n.includes('approval') && !n.includes('approved')
}

const CACHE_KEY = 'tasks:pending_approval'
const CACHE_TTL_MINUTES = 2

export async function GET() {
  try {
    const cached = await getCachedJson<{ instances: unknown[]; fetchedAt: string }>(CACHE_KEY, CACHE_TTL_MINUTES)
    if (cached) return NextResponse.json({ ...cached.payload, cached: true })

    const startDate = daysAgoIso(14)
    const endDate = todayIso()

    // No taskTemplateIds → Trail returns instances from all templates
    const all = await fetchAllTaskInstances(startDate, endDate)
    const instances = all.filter(i => isPendingApproval(i.status))

    const result = { instances, fetchedAt: new Date().toISOString() }
    await setCachedJson(CACHE_KEY, result)

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Pending approval fetch error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
