import { NextResponse } from 'next/server'
import { todayIso, daysAgoIso } from '@/lib/trail/cache'

// TEMPORARY diagnostic route — phase 2.
// The task instance API has no approval field at all.
// Hypothesis: approval is configured at the template level.
// Known pending-approval template IDs: 247590 (pool25m), 820783 (bathrLoads).
//
// Open /api/trail/debug/approval — share the full JSON response.

const BASE_URL = 'https://web.trailapp.com/api/public'

function getApiKey() {
  const key = process.env.TRAIL_API_KEY
  if (!key) throw new Error('TRAIL_API_KEY not set')
  return key
}

async function trailFetch(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { 'API_KEY': getApiKey(), 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Trail ${endpoint} → ${res.status}: ${JSON.stringify(err)}`)
  }
  return res.json()
}

type Instance = {
  taskInstanceId: number
  taskTemplateId: number
  taskInstanceName: string
  status: string
}

// Fetch all pages for a query, optionally adding a URL query string.
async function fetchAll(body: Record<string, unknown>, queryString = ''): Promise<Instance[]> {
  const all: Instance[] = []
  let cursor: string | null = null
  do {
    const payload: Record<string, unknown> = { ...body }
    if (cursor) payload.pageStart = cursor
    const r: { data: Instance[]; page?: { nextCursor: string | null } } = await trailFetch(
      `/task_reports/v1/task_instances${queryString}`,
      { method: 'POST', body: JSON.stringify(payload) }
    )
    all.push(...r.data)
    cursor = r.page?.nextCursor ?? null
  } while (cursor)
  return all
}

function summarise(rows: Instance[]) {
  const byTemplate: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const templateNames: Record<string, string> = {}
  for (const r of rows) {
    byTemplate[r.taskTemplateId] = (byTemplate[r.taskTemplateId] ?? 0) + 1
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    templateNames[r.taskTemplateId] = r.taskInstanceName
  }
  return { total: rows.length, distinctTemplates: Object.keys(byTemplate).length, byStatus, byTemplate, templateNames }
}

export async function GET() {
  try {
    const templateData = await trailFetch('/task_templates/v1/list')
    const allTemplates = (templateData.data ?? []) as { id: number }[]
    const templateIds = allTemplates.map(t => t.id)

    // Short window keeps this well under serverless timeout.
    const start = daysAgoIso(5)
    const end = todayIso()
    const base = { startDate: start, endDate: end, taskTemplateIds: templateIds }

    // Decisive comparison: all templates, with vs without the approval query param.
    const withFilter = await fetchAll(base, '?approval=pending_approval')
    const without = await fetchAll(base)

    return NextResponse.json({
      window: { start, end },
      withApprovalParam: summarise(withFilter),
      withoutParam: summarise(without),
      filterNarrowsResults: withFilter.length !== without.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
