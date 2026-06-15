import { getToken } from '@vercel/connect'
import { getSql } from './db'

const DB_ID = process.env.NOTION_PO_DATABASE_ID ?? '3804aed9d36380c19630cf52f59f26f3'
const CONNECT_CONNECTOR = 'api.notion.com/lw-ops-toolbox'
const NOTION_VERSION = '2022-06-28'

async function getNotionToken(): Promise<string> {
  if (process.env.NOTION_TOKEN) return process.env.NOTION_TOKEN
  return getToken(CONNECT_CONNECTOR, { subject: { type: 'app' } })
}

function notionHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PoStatus   = 'Pending Review' | 'Approved' | 'Rejected' | 'More Info Requested'
export type PoUrgency  = 'Routine' | 'Urgent' | 'Emergency'
export type PoSite     = 'Bishopstown' | 'Churchfield'

export interface PoRecord {
  id: string
  description: string
  site: PoSite
  status: PoStatus
  value: number
  supplier: string
  urgency: PoUrgency
  poNumber: string | null
  requestedBy: string
  requestDate: string | null
  decisionDate: string | null
  adminNotes: string | null
  quoteFilename: string | null
  createdTime: string
}

export interface CreatePoInput {
  description: string
  site: PoSite
  value: number
  supplier: string
  urgency: PoUrgency
  requestedBy: string
  quoteFilename: string | null
}

export interface UpdatePoInput {
  status: PoStatus
  poNumber?: string
  adminNotes?: string
}

// ── Property helpers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function txt(prop: any): string {
  return prop?.rich_text?.map((t: { plain_text: string }) => t.plain_text).join('') ?? ''
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function title(prop: any): string {
  return prop?.title?.map((t: { plain_text: string }) => t.plain_text).join('') ?? ''
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sel(prop: any): string { return prop?.select?.name ?? '' }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(prop: any): number { return prop?.number ?? 0 }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function date(prop: any): string | null { return prop?.date?.start ?? null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToRecord(page: any): PoRecord {
  const p = page.properties
  return {
    id: page.id,
    description: title(p['Name']),
    site: sel(p['Site']) as PoSite,
    status: sel(p['Status']) as PoStatus,
    value: num(p['Value']),
    supplier: txt(p['Supplier']),
    urgency: sel(p['Urgency']) as PoUrgency,
    poNumber: txt(p['PO Number']) || null,
    requestedBy: txt(p['Requested By']),
    requestDate: date(p['Request Date']),
    decisionDate: date(p['Decision Date']),
    adminNotes: txt(p['Admin Notes']) || null,
    quoteFilename: txt(p['Quote Filename']) || null,
    createdTime: page.created_time,
  }
}

// ── Notion DB setup ────────────────────────────────────────────────────────────

let setupDone = false

export async function ensureNotionSetup() {
  if (setupDone) return
  setupDone = true
  try {
    const token = await getNotionToken()
    // Use raw REST API — SDK v5 removed `properties` from UpdateDatabaseParameters
    const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}`, {
      method: 'PATCH',
      headers: notionHeaders(token),
      body: JSON.stringify({
        properties: {
          Site: {
            select: {
              options: [
                { name: 'Bishopstown', color: 'blue' },
                { name: 'Churchfield', color: 'green' },
              ],
            },
          },
          Status: {
            select: {
              options: [
                { name: 'Pending Review',      color: 'yellow' },
                { name: 'Approved',            color: 'green'  },
                { name: 'Rejected',            color: 'red'    },
                { name: 'More Info Requested', color: 'orange' },
              ],
            },
          },
          Value:            { number: { format: 'euro' } },
          Supplier:         { rich_text: {} },
          Urgency: {
            select: {
              options: [
                { name: 'Routine',   color: 'gray'   },
                { name: 'Urgent',    color: 'orange' },
                { name: 'Emergency', color: 'red'    },
              ],
            },
          },
          'PO Number':      { rich_text: {} },
          'Requested By':   { rich_text: {} },
          'Request Date':   { date: {} },
          'Decision Date':  { date: {} },
          'Admin Notes':    { rich_text: {} },
          'Quote Filename': { rich_text: {} },
        },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[notion-po] DB setup failed:', err)
      setupDone = false  // allow retry on next request
    }
  } catch (e) {
    console.error('[notion-po] DB setup error:', e)
    setupDone = false
  }
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function listPoRequests(): Promise<PoRecord[]> {
  await ensureNotionSetup()
  const token = await getNotionToken()
  const results: PoRecord[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 100,
    }
    if (cursor) body.start_cursor = cursor

    const resp = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify(body),
    })
    if (!resp.ok) throw new Error(`Notion query failed: ${resp.status}`)
    const data = await resp.json()
    for (const page of data.results) results.push(pageToRecord(page))
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results
}

export async function getPoRequest(id: string): Promise<PoRecord | null> {
  try {
    const token = await getNotionToken()
    const resp = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      headers: notionHeaders(token),
    })
    if (!resp.ok) return null
    return pageToRecord(await resp.json())
  } catch {
    return null
  }
}

export async function createPoRequest(input: CreatePoInput): Promise<PoRecord> {
  await ensureNotionSetup()
  const token = await getNotionToken()
  const today = new Date().toISOString().split('T')[0]
  const resp = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders(token),
    body: JSON.stringify({
      parent: { database_id: DB_ID },
      properties: {
        Name:             { title:     [{ text: { content: input.description } }] },
        Site:             { select:    { name: input.site } },
        Status:           { select:    { name: 'Pending Review' } },
        Value:            { number:    input.value },
        Supplier:         { rich_text: [{ text: { content: input.supplier } }] },
        Urgency:          { select:    { name: input.urgency } },
        'PO Number':      { rich_text: [] },
        'Requested By':   { rich_text: [{ text: { content: input.requestedBy } }] },
        'Request Date':   { date:      { start: today } },
        'Admin Notes':    { rich_text: [] },
        'Quote Filename': { rich_text: input.quoteFilename
          ? [{ text: { content: input.quoteFilename } }]
          : [] },
      },
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`Notion page create failed: ${JSON.stringify(err)}`)
  }
  return pageToRecord(await resp.json())
}

export async function updatePoRequest(id: string, input: UpdatePoInput): Promise<PoRecord> {
  const token = await getNotionToken()
  const today = new Date().toISOString().split('T')[0]
  const resp = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: 'PATCH',
    headers: notionHeaders(token),
    body: JSON.stringify({
      properties: {
        Status:          { select: { name: input.status } },
        'Decision Date': { date:   { start: today } },
        ...(input.poNumber !== undefined
          ? { 'PO Number': { rich_text: [{ text: { content: input.poNumber } }] } }
          : {}),
        ...(input.adminNotes !== undefined
          ? { 'Admin Notes': { rich_text: input.adminNotes
              ? [{ text: { content: input.adminNotes } }]
              : [] } }
          : {}),
      },
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`Notion page update failed: ${JSON.stringify(err)}`)
  }
  return pageToRecord(await resp.json())
}

// ── PO number generation (atomic via Postgres) ─────────────────────────────────

export async function generatePoNumber(site: PoSite): Promise<string> {
  const siteCode = site === 'Bishopstown' ? 'BT' : 'CF'
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const yearMonth = `${yy}${mm}`

  const sql = await getSql()
  // Atomic upsert — inserts (1) on first PO of the month, increments thereafter
  const rows = await sql`
    INSERT INTO po_sequences (site_code, year_month, last_number)
    VALUES (${siteCode}, ${yearMonth}, 1)
    ON CONFLICT (site_code, year_month) DO UPDATE
      SET last_number = po_sequences.last_number + 1
    RETURNING last_number` as { last_number: number }[]
  const n = rows[0].last_number
  return `LW${siteCode}${mm}${yy}${String(n).padStart(4, '0')}`
}

// ── File storage (Postgres) ────────────────────────────────────────────────────

export async function savePoFile(
  notionPageId: string,
  filename: string,
  contentType: string,
  data: Buffer
) {
  const sql = await getSql()
  await sql`
    INSERT INTO po_files (notion_page_id, filename, content_type, size_bytes, data)
    VALUES (${notionPageId}, ${filename}, ${contentType}, ${data.length}, ${data.toString('base64')})
    ON CONFLICT (notion_page_id) DO UPDATE
      SET filename = excluded.filename,
          content_type = excluded.content_type,
          size_bytes = excluded.size_bytes,
          data = excluded.data,
          uploaded_at = now()`
}

export async function getPoFile(notionPageId: string) {
  const sql = await getSql()
  const rows = await sql`
    SELECT filename, content_type, data FROM po_files WHERE notion_page_id = ${notionPageId}
  ` as { filename: string; content_type: string; data: string }[]
  if (!rows[0]) return null
  return {
    filename:    rows[0].filename,
    contentType: rows[0].content_type,
    data:        Buffer.from(rows[0].data, 'base64'),
  }
}
