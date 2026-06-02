// Trail API client — all calls go through here
const BASE_URL = 'https://web.trailapp.com/api/public'

function getApiKey() {
  const key = process.env.TRAIL_API_KEY
  if (!key) throw new Error('TRAIL_API_KEY environment variable is not set')
  return key
}

async function trailFetch(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'API_KEY': getApiKey(),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Trail API ${endpoint} → ${res.status}: ${JSON.stringify(err)}`)
  }
  return res.json()
}

// ── Reference data ────────────────────────────────────────────────
export async function fetchSites() {
  const data = await trailFetch('/sites/v1/list')
  return data.data as TrailSite[]
}

export async function fetchTags() {
  const data = await trailFetch('/tags/v1/list')
  return data.data as TrailTag[]
}

export async function fetchTaskTemplates() {
  const data = await trailFetch('/task_templates/v1/list')
  return data.data as TrailTemplate[]
}

// ── Task reports (POST endpoints) ────────────────────────────────
export async function fetchTaskInstances(
  startDate: string,
  endDate: string,
  taskTemplateIds: number[],
  pageStart?: string
): Promise<{ data: TrailTaskInstance[]; nextCursor: string | null }> {
  const body: Record<string, unknown> = { startDate, endDate, taskTemplateIds }
  if (pageStart) body.pageStart = pageStart

  const result = await trailFetch('/task_reports/v1/task_instances', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return {
    data: result.data,
    nextCursor: result.page?.nextCursor ?? null,
  }
}

export async function fetchAllTaskInstances(
  startDate: string,
  endDate: string,
  taskTemplateIds: number[]
): Promise<TrailTaskInstance[]> {
  const all: TrailTaskInstance[] = []
  let cursor: string | null = null
  do {
    const { data, nextCursor } = await fetchTaskInstances(startDate, endDate, taskTemplateIds, cursor ?? undefined)
    all.push(...data)
    cursor = nextCursor
    if (cursor) await sleep(300) // gentle rate limiting
  } while (cursor)
  return all
}

export async function fetchRecordLogs(taskInstanceIds: number[]): Promise<Record<string, TrailRecordLog[]>> {
  if (taskInstanceIds.length === 0) return {}
  const result = await trailFetch('/task_reports/v1/record_logs', {
    method: 'POST',
    body: JSON.stringify({ taskInstanceIds }),
  })
  return result.data ?? {}
}

export async function fetchChecklists(taskInstanceIds: number[]): Promise<Record<string, TrailChecklistItem[]>> {
  if (taskInstanceIds.length === 0) return {}
  const result = await trailFetch('/task_reports/v1/checklists', {
    method: 'POST',
    body: JSON.stringify({ taskInstanceIds }),
  })
  return result.data ?? {}
}

export async function fetchScores(
  startDate: string,
  endDate: string,
  dateInterval: 'day' | 'week' | 'month',
  siteIds?: number[]
) {
  const body: Record<string, unknown> = { startDate, endDate, dateInterval }
  if (siteIds?.length) body.siteIds = siteIds
  const result = await trailFetch('/scores/v1/scores', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return result.data as TrailScore[]
}

// ── Helpers ───────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Types ─────────────────────────────────────────────────────────
export interface TrailSite {
  id: number
  name: string
  status: string
  external_id: string | null
  area_id: number | null
}

export interface TrailTag {
  id: number
  label: string
}

export interface TrailTemplate {
  id: number
  name: string
  status: string
  type: string
}

export interface TrailTaskInstance {
  taskInstanceId: number
  taskInstanceName: string
  taskTemplateId: number
  dueFromDatetime: string
  dueByDatetime: string
  completedDatetime: string | null
  completedByUserId: number | null
  completedByUserName: string | null
  taskType: string
  areaId: number | null
  areaName: string | null
  siteId: number
  siteName: string
  flaggedChecklistCount: number
  addedChecklistCount: number
  recordLogExceptionCount: number
  exceptionTypes: string[]
  requiresPin: boolean
  priority: 'low' | 'medium' | 'high'
  exceptionCount: number
  actionTaskInstanceIds: number[]
  linkedTaskInstanceId: number | null
  businessDates: string[]
  status: string
  tags: { tagId: number; label: string }[]
}

export interface TrailRecordField {
  id: string
  name: string
  value: string | number | null
  type: string
  hasError: boolean
  errors: string[]
}

export interface TrailRecordLog {
  recordLogId: number
  records: Record<string, TrailRecordField & { [key: string]: any }>[]
  hasError: boolean
}

export interface TrailChecklistItem {
  checkId: number
  checkName: string
  status: string
  completedDatetime: string | null
  completedByUserName: string | null
  completedByUserId: number | null
  header: string | null
}

export interface TrailScore {
  id: number
  level: 'site' | 'area' | 'average'
  name: string
  average: number
  scores: Record<string, { score: number; status: string | null }>
}

// ── Known template IDs for LeisureWorld ──────────────────────────
export const TEMPLATE_IDS = {
  pool25m:           247590,
  pool18m:           269953,
  poolLearners:      269952,
  chlorineCO2Stock:  502146,
  alkalinity25m:     396739,
  alkalinity18m:     396742,
  alkalinityLearners:396745,
  poolAlarmTest:     440598,
  incidentBT:        566160,
  incidentDG:        674497,
  nearMissDG:        674510,
  handoverBT:        653723,
  handoverCF:        656562,
  dailyOpsLog:       348734,
  rescueEquipBT:     244057,
  bathrLoads:        820783,
} as const

export const CHEMISTRY_TEMPLATE_IDS = [
  TEMPLATE_IDS.pool25m,
  TEMPLATE_IDS.pool18m,
  TEMPLATE_IDS.poolLearners,
  TEMPLATE_IDS.chlorineCO2Stock,
]

export const INCIDENT_TEMPLATE_IDS = [
  TEMPLATE_IDS.incidentBT,
  TEMPLATE_IDS.incidentDG,
  TEMPLATE_IDS.nearMissDG,
]

export const HANDOVER_TEMPLATE_IDS = [
  TEMPLATE_IDS.handoverBT,
  TEMPLATE_IDS.handoverCF,
]
