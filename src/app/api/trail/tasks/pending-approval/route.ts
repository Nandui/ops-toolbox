import { NextResponse } from 'next/server'
import { fetchTaskTemplates, fetchAllTaskInstances } from '@/lib/trail/client'
import { getCachedJson, setCachedJson, todayIso, daysAgoIso } from '@/lib/trail/cache'

// Pending-approval tasks can belong to any template, so we first fetch the
// full template list, then search across all of them for the last 14 days.
// Trail's camelCase status convention: pendingApproval (like completedLate).

function isPendingApproval(status: string) {
  const n = (status || '').toLowerCase()
  return n.includes('approval') && !n.includes('approved')
}

const CACHE_KEY = 'tasks:pending_approval'
const TEMPLATE_CACHE_KEY = 'trail:all_template_ids'
const CACHE_TTL_MINUTES = 2

export async function GET() {
  try {
    const cached = await getCachedJson<{ instances: unknown[]; fetchedAt: string }>(CACHE_KEY, CACHE_TTL_MINUTES)
    if (cached) return NextResponse.json({ ...cached.payload, cached: true })

    // Get all template IDs — cache them for 60 min (templates rarely change)
    let templateIds: number[]
    const cachedTemplates = await getCachedJson<{ ids: number[] }>(TEMPLATE_CACHE_KEY, 60)
    if (cachedTemplates) {
      templateIds = cachedTemplates.payload.ids
    } else {
      const templates = await fetchTaskTemplates()
      templateIds = templates.map(t => t.id)
      await setCachedJson(TEMPLATE_CACHE_KEY, { ids: templateIds })
    }

    const startDate = daysAgoIso(14)
    const endDate = todayIso()

    const all = await fetchAllTaskInstances(startDate, endDate, templateIds)
    const instances = all.filter(i => isPendingApproval(i.status))

    const result = { instances, fetchedAt: new Date().toISOString() }
    await setCachedJson(CACHE_KEY, result)

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Pending approval fetch error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
