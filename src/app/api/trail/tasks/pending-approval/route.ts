import { NextResponse } from 'next/server'
import { fetchTaskTemplates, fetchPendingApprovalInstances } from '@/lib/trail/client'
import { getCachedJson, setCachedJson, todayIso, daysAgoIso } from '@/lib/trail/cache'

// Trail's web UI surfaces pending-approval tasks via:
//   https://web.trailapp.com/reports#/tasks?approval=pending_approval
//
// We pass the same `approval: 'pending_approval'` filter to the task_instances
// API and search across all templates for the last 14 days, since these tasks
// can belong to any template and may pre-date today.

const CACHE_KEY = 'tasks:pending_approval'
const TEMPLATE_CACHE_KEY = 'trail:all_template_ids'

export async function GET() {
  try {
    const cached = await getCachedJson<{ instances: unknown[]; fetchedAt: string }>(CACHE_KEY, 2)
    if (cached) return NextResponse.json({ ...cached.payload, cached: true })

    // Template list changes rarely — cache for 60 min
    let templateIds: number[]
    const cachedTemplates = await getCachedJson<{ ids: number[] }>(TEMPLATE_CACHE_KEY, 60)
    if (cachedTemplates) {
      templateIds = cachedTemplates.payload.ids
    } else {
      const templates = await fetchTaskTemplates()
      templateIds = templates.map(t => t.id)
      await setCachedJson(TEMPLATE_CACHE_KEY, { ids: templateIds })
    }

    const instances = await fetchPendingApprovalInstances(daysAgoIso(14), todayIso(), templateIds)

    const result = { instances, fetchedAt: new Date().toISOString() }
    await setCachedJson(CACHE_KEY, result)

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Pending approval fetch error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
