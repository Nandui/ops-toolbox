import { NextResponse } from 'next/server'
import { todayIso, daysAgoIso } from '@/lib/trail/cache'

// TEMPORARY diagnostic route — phase 2.
// The task instance API has no approval field at all.
// Hypothesis: approval is configured at the template level.
// Known pending-approval template IDs: 247590 (pool25m), 820783 (bathrLoads).
//
// Open /api/trail/debug/approval — share the full JSON response.

const BASE_URL = 'https://web.trailapp.com/api/public'
const KNOWN_PENDING_TEMPLATE_IDS = [247590, 820783]

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

export async function GET() {
  try {
    // 1. Inspect raw template data — are there approval-related fields beyond id/name/status/type?
    const templateData = await trailFetch('/task_templates/v1/list')
    const allTemplates = (templateData.data ?? []) as Record<string, unknown>[]

    // Build field inventory for templates
    type FI = { types: Set<string>; distinct: Map<string, number>; tooMany: boolean; example: unknown }
    const templateFieldInfo: Record<string, FI> = {}
    for (const t of allTemplates) {
      for (const [k, v] of Object.entries(t)) {
        if (!templateFieldInfo[k]) templateFieldInfo[k] = { types: new Set(), distinct: new Map(), tooMany: false, example: v }
        const fi = templateFieldInfo[k]
        fi.types.add(Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v)
        if (!fi.tooMany && (typeof v === 'boolean' || typeof v === 'string')) {
          const key = String(v)
          fi.distinct.set(key, (fi.distinct.get(key) ?? 0) + 1)
          if (fi.distinct.size > 20) fi.tooMany = true
        } else if (!fi.tooMany) fi.tooMany = true
      }
    }

    const templateFields = Object.fromEntries(
      Object.entries(templateFieldInfo).map(([k, fi]) => [k, {
        types: [...fi.types],
        values: fi.tooMany ? null : Object.fromEntries(fi.distinct),
        example: fi.tooMany ? fi.example : undefined,
      }])
    )

    // Full raw data for the two templates with known pending approval tasks
    const knownPendingTemplates = Object.fromEntries(
      KNOWN_PENDING_TEMPLATE_IDS.map(id => [id, allTemplates.find(t => t.id === id) ?? null])
    )

    // 2. Try fetching task instances with approval filter as a QUERY PARAM (not body),
    //    and also try a GET request variant, to see if Trail supports it differently.
    const start = daysAgoIso(14)
    const end = todayIso()
    let approvalQueryResult: unknown = null
    try {
      const r = await fetch(
        `${BASE_URL}/task_reports/v1/task_instances?approval=pending_approval`,
        {
          method: 'POST',
          headers: { 'API_KEY': getApiKey(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: start, endDate: end, taskTemplateIds: KNOWN_PENDING_TEMPLATE_IDS }),
          cache: 'no-store',
        }
      )
      approvalQueryResult = await r.json()
    } catch (e) {
      approvalQueryResult = { error: String(e) }
    }

    return NextResponse.json({
      templateFields,
      knownPendingTemplates,
      approvalAsQueryParam: approvalQueryResult,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
