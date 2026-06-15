/* eslint-disable @typescript-eslint/no-explicit-any */
import { getToken } from '@vercel/connect'

const NOTION_VERSION = '2022-06-28'
const CONNECT_CONNECTOR = 'api.notion.com/lw-ops-toolbox'
export const PO_DATABASE_ID = '3804aed9d36380d08645e593559dd5d1'

export type PoStatus  = 'Pending Review' | 'Approved' | 'Rejected'
export type PoUrgency = 'Routine' | 'Urgent' | 'Emergency'
export type PoSite    = 'Bishopstown' | 'Churchfield'

export interface PoRequest {
  id: string
  description: string
  site: PoSite
  supplier: string
  urgency: PoUrgency
  value: number
  status: PoStatus
  poNumber: string | null
  requestedBy: string
  requestDate: string | null
  decisionDate: string | null
  adminNotes: string | null
  createdTime: string
}

async function getApiKey(): Promise<string> {
  if (process.env.NOTION_TOKEN) return process.env.NOTION_TOKEN
  return getToken(CONNECT_CONNECTOR, { subject: { type: 'app' } })
}

async function notionFetch(path: string, init: RequestInit = {}) {
  const key = await getApiKey()
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
      ...init.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(JSON.stringify(err))
  }
  return res.json()
}

function toRecord(page: any): PoRequest {
  const p = page.properties
  const txt   = (x: any) => x?.rich_text?.map((t: any) => t.plain_text).join('') ?? ''
  const title = (x: any) => x?.title?.map((t: any) => t.plain_text).join('') ?? ''
  const sel   = (x: any) => x?.select?.name ?? ''
  const num   = (x: any) => x?.number ?? 0
  const date  = (x: any) => x?.date?.start ?? null
  return {
    id:          page.id,
    description: title(p['Name']),
    site:        sel(p['Site']) as PoSite,
    supplier:    txt(p['Supplier']),
    urgency:     sel(p['Urgency']) as PoUrgency,
    value:       num(p['Value']),
    status:      (sel(p['Status']) || 'Pending Review') as PoStatus,
    poNumber:    txt(p['PO Number']) || null,
    requestedBy: txt(p['Requested By']),
    requestDate: date(p['Request Date']),
    decisionDate:date(p['Decision Date']),
    adminNotes:  txt(p['Admin Notes']) || null,
    createdTime: page.created_time,
  }
}

// ── DB schema setup (non-fatal) ────────────────────────────────────────────────

let setupDone = false

export async function ensurePoDbSetup() {
  if (setupDone) return
  setupDone = true
  try {
    await notionFetch(`/databases/${PO_DATABASE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          Site: {
            select: {
              options: [
                { name: 'Bishopstown', color: 'blue'  },
                { name: 'Churchfield', color: 'green' },
              ],
            },
          },
          Status: {
            select: {
              options: [
                { name: 'Pending Review', color: 'yellow' },
                { name: 'Approved',       color: 'green'  },
                { name: 'Rejected',       color: 'red'    },
              ],
            },
          },
          Value:          { number: { format: 'euro' } },
          Supplier:       { rich_text: {} },
          Urgency: {
            select: {
              options: [
                { name: 'Routine',   color: 'gray'   },
                { name: 'Urgent',    color: 'orange' },
                { name: 'Emergency', color: 'red'    },
              ],
            },
          },
          'PO Number':    { rich_text: {} },
          'Requested By': { rich_text: {} },
          'Request Date': { date: {} },
          'Decision Date':{ date: {} },
          'Admin Notes':  { rich_text: {} },
        },
      }),
    })
  } catch {
    setupDone = false
  }
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function listPoRequests(): Promise<PoRequest[]> {
  await ensurePoDbSetup()
  const results: PoRequest[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 100,
    }
    if (cursor) body.start_cursor = cursor
    const data = await notionFetch(`/databases/${PO_DATABASE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    for (const page of data.results) results.push(toRecord(page))
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results
}

export async function createPoRequest(input: {
  description: string
  site: PoSite
  supplier: string
  urgency: PoUrgency
  value: number
  requestedBy: string
}): Promise<PoRequest> {
  await ensurePoDbSetup()
  const today = new Date().toISOString().split('T')[0]
  const page = await notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: PO_DATABASE_ID },
      properties: {
        Name:           { title:     [{ text: { content: input.description } }] },
        Site:           { select:    { name: input.site } },
        Supplier:       { rich_text: [{ text: { content: input.supplier } }] },
        Urgency:        { select:    { name: input.urgency } },
        Value:          { number:    input.value },
        Status:         { select:    { name: 'Pending Review' } },
        'PO Number':    { rich_text: [] },
        'Requested By': { rich_text: [{ text: { content: input.requestedBy } }] },
        'Request Date': { date:      { start: today } },
        'Admin Notes':  { rich_text: [] },
      },
    }),
  })
  return toRecord(page)
}

export async function updatePoRequest(id: string, input: {
  status: PoStatus
  poNumber?: string
  adminNotes?: string
}): Promise<PoRequest> {
  const today = new Date().toISOString().split('T')[0]
  const page = await notionFetch(`/pages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        Status:          { select: { name: input.status } },
        'Decision Date': { date:   { start: today } },
        ...(input.poNumber !== undefined
          ? { 'PO Number': { rich_text: input.poNumber
              ? [{ text: { content: input.poNumber } }]
              : [] } }
          : {}),
        ...(input.adminNotes !== undefined
          ? { 'Admin Notes': { rich_text: input.adminNotes
              ? [{ text: { content: input.adminNotes } }]
              : [] } }
          : {}),
      },
    }),
  })
  return toRecord(page)
}
