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
  quoteUrl: string | null
  quoteName: string | null
  createdTime: string
}

// Single-part Notion file uploads are capped at 20 MB.
export const MAX_QUOTE_BYTES = 20 * 1024 * 1024

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
  const fileUrl  = (x: any) => {
    const f = x?.files?.[0]
    return f ? (f.file?.url ?? f.external?.url ?? null) : null
  }
  const fileName = (x: any) => x?.files?.[0]?.name ?? null
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
    quoteUrl:    fileUrl(p['Quote']),
    quoteName:   fileName(p['Quote']),
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
          Quote:          { files: {} },
        },
      }),
    })
  } catch {
    setupDone = false
  }
}

// ── File uploads ────────────────────────────────────────────────────────────────

/**
 * Uploads a file to Notion using the single-part File Upload API and returns
 * the file_upload id, which can then be referenced from a `files` property.
 */
async function uploadFileToNotion(file: File): Promise<{ id: string; name: string }> {
  const key = await getApiKey()

  // 1. Create the file upload object.
  const createRes = await fetch('https://api.notion.com/v1/file_uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
    }),
  })
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    throw new Error(`Notion file upload (create) failed: ${JSON.stringify(err)}`)
  }
  const upload = await createRes.json()

  // 2. Send the file content as multipart/form-data. Do NOT set Content-Type
  //    manually — fetch derives the multipart boundary from the FormData body.
  const form = new FormData()
  form.append('file', file, file.name)
  const sendRes = await fetch(upload.upload_url ?? `https://api.notion.com/v1/file_uploads/${upload.id}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
    },
    body: form,
  })
  if (!sendRes.ok) {
    const err = await sendRes.json().catch(() => ({}))
    throw new Error(`Notion file upload (send) failed: ${JSON.stringify(err)}`)
  }

  return { id: upload.id, name: file.name }
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
  quote: File
}): Promise<PoRequest> {
  await ensurePoDbSetup()
  const today = new Date().toISOString().split('T')[0]
  const quote = await uploadFileToNotion(input.quote)
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
        Quote:          { files: [{ type: 'file_upload', file_upload: { id: quote.id }, name: quote.name }] },
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
