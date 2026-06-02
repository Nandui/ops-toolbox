/* eslint-disable @typescript-eslint/no-explicit-any */
// Notion's API returns deeply polymorphic property values (rich_text, select,
// people, files, formula…) that cannot be cleanly typed without the official
// Notion SDK. `any` is intentional here for the raw property accessors.
const NOTION_VERSION = '2025-09-03'
const INCIDENTS_DATA_SOURCE_ID = '28b4aed9-d363-8083-b13d-000b80fcbb8f'
const INCIDENTS_DATABASE_ID = '28b4aed9-d363-80db-b912-ec2a8cad5a70'

const SITE_OPTIONS = ['Douglas', 'Churchfield', 'Bishopstown'] as const
const CATEGORY_OPTIONS = [
  'Aggressive Behaviour',
  'Child Safeguarding',
  'Medical / First Aid',
  'Slip / Trip / Fall',
  'Pool / Water Safety',
  'Equipment / Facility Damage',
  'Theft / Security',
  'Complaint (Service)',
  'Operational',
] as const
const SEVERITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'] as const
const AREA_OPTIONS = ['Pool', 'Gym', 'Reception', 'Changing Rooms', 'Car Park', 'Studio', 'Cafe'] as const
const ACTIVE_STATUS_NAME = 'Closed'

type NotionUser = {
  object: 'user'
  id: string
  name: string | null
  type: string
  person?: { email?: string }
}

type NotionPage = {
  id: string
  url: string
  created_time: string
  properties: Record<string, any>
}

export type IncidentOptionSet = {
  sites: string[]
  categories: string[]
  severities: string[]
  areas: string[]
}

export type ActiveIncident = {
  pageId: string
  url: string
  title: string
  status: string
  site: string | null
  incidentDate: string | null
  incidentTime: string
  category: string | null
  severity: string | null
  likelyArea: string | null
  peopleInvolved: string
  reviewNotes: string
  reportedBy: Array<{ id: string; name: string; email: string | null }>
  files: Array<{ name: string; url: string | null }>
  daysOpen: number | null
  createdTime: string
}

export type CreateIncidentInput = {
  reportTitle?: string
  site: string
  incidentDate: string
  incidentTime?: string
  category: string
  severity: string
  likelyArea: string
  description: string
  peopleInvolved?: string
  reviewNotes?: string
  fileUrls?: string[]
  reporterNotionUserId?: string | null
  reporterName?: string | null
}

function getApiKey() {
  const key = process.env.NOTION_API_KEY
  if (!key) throw new Error('NOTION_API_KEY environment variable is not set')
  return key
}

async function notionFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const error = await res.text().catch(() => '')
    throw new Error(`Notion ${path} → ${res.status}: ${error || res.statusText}`)
  }

  return res.json()
}

function textFromProperty(prop: any) {
  if (!prop) return ''
  if (typeof prop === 'string') return prop
  if (Array.isArray(prop.rich_text)) return prop.rich_text.map((part: any) => part?.plain_text ?? part?.text?.content ?? '').join('')
  if (Array.isArray(prop.title)) return prop.title.map((part: any) => part?.plain_text ?? part?.text?.content ?? '').join('')
  if (prop.select?.name) return prop.select.name
  if (prop.status?.name) return prop.status.name
  if (Array.isArray(prop.people)) return prop.people.map((p: any) => p?.name ?? p?.person?.email ?? p?.id).filter(Boolean).join(', ')
  if (prop.number != null) return String(prop.number)
  return ''
}

function richTextContent(value: string | undefined) {
  const text = (value || '').trim()
  return text ? [{ type: 'text', text: { content: text } }] : []
}

function parseFiles(fileUrls: string[] | undefined) {
  return (fileUrls || [])
    .map(url => url.trim())
    .filter(Boolean)
    .map(url => ({
      name: url.split('/').pop() || 'Attachment',
      type: 'external' as const,
      external: { url },
    }))
}

function parseDaysOpen(prop: any) {
  if (!prop) return null
  if (typeof prop.formula?.number === 'number') return prop.formula.number
  if (typeof prop.number === 'number') return prop.number
  return null
}

function parseReportedBy(prop: any) {
  if (!prop || !Array.isArray(prop.people)) return []
  return prop.people.map((person: any) => ({
    id: person.id,
    name: person.name || person.person?.email || 'Unknown',
    email: person.person?.email ?? null,
  }))
}

function parseFilesProperty(prop: any) {
  if (!prop || !Array.isArray(prop.files)) return []
  return prop.files.map((file: any) => ({
    name: file.name || 'Attachment',
    url: file.type === 'external' ? file.external?.url ?? null : file.file?.url ?? null,
  }))
}

function parseIncident(page: NotionPage): ActiveIncident {
  const props = page.properties || {}
  return {
    pageId: page.id,
    url: page.url,
    title: textFromProperty(props['Report']) || 'Untitled incident',
    status: textFromProperty(props['Status']) || 'Unknown',
    site: textFromProperty(props['Site']) || null,
    incidentDate: props['Incident Date']?.date?.start ?? null,
    incidentTime: textFromProperty(props['Incident Time']),
    category: textFromProperty(props['Category']) || null,
    severity: textFromProperty(props['Severity']) || null,
    likelyArea: textFromProperty(props['Likely Area']) || null,
    peopleInvolved: textFromProperty(props['People / Staff Involved']),
    reviewNotes: textFromProperty(props['Review Notes']),
    reportedBy: parseReportedBy(props['Reported by:']),
    files: parseFilesProperty(props['Files & media']),
    daysOpen: parseDaysOpen(props['Days Open']),
    createdTime: page.created_time,
  }
}

export async function fetchActiveIncidents() {
  const results: ActiveIncident[] = []
  let cursor: string | null = null

  do {
    const body: Record<string, any> = {
      page_size: 100,
      filter: {
        property: 'Status',
        status: {
          does_not_equal: ACTIVE_STATUS_NAME,
        },
      },
      sorts: [
        { property: 'Incident Date', direction: 'descending' },
        { timestamp: 'created_time', direction: 'descending' },
      ],
    }

    if (cursor) body.start_cursor = cursor

    const data = await notionFetch(`/data_sources/${INCIDENTS_DATA_SOURCE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    })

    const pages = (data.results || []) as NotionPage[]
    results.push(...pages.map(parseIncident))
    cursor = data.has_more ? data.next_cursor : null
  } while (cursor)

  return results
}

export function getIncidentOptions(): IncidentOptionSet {
  return {
    sites: [...SITE_OPTIONS],
    categories: [...CATEGORY_OPTIONS],
    severities: [...SEVERITY_OPTIONS],
    areas: [...AREA_OPTIONS],
  }
}

export async function findNotionUserByEmail(email: string) {
  const target = email.trim().toLowerCase()
  if (!target) return null

  const data = await notionFetch('/users', { method: 'GET' })
  const users = (data.results || []) as NotionUser[]
  return users.find(user => (user.person?.email || '').toLowerCase() === target) || null
}

export async function createIncidentPage(input: CreateIncidentInput) {
  const title = input.reportTitle?.trim() || `New submission`
  const reporterId = input.reporterNotionUserId || null

  const properties: Record<string, any> = {
    Report: { title: richTextContent(title) },
    Status: { status: { name: 'Not Reviewed' } },
    Site: { select: { name: input.site } },
    'Incident Date': { date: { start: input.incidentDate } },
    'Incident Time': { rich_text: richTextContent(input.incidentTime) },
    Category: { select: { name: input.category } },
    Severity: { select: { name: input.severity } },
    'Likely Area': { select: { name: input.likelyArea } },
    'Describe what happened:': { rich_text: richTextContent(input.description) },
    'People / Staff Involved': { rich_text: richTextContent(input.peopleInvolved) },
    'Review Notes': { rich_text: richTextContent(input.reviewNotes) },
  }

  const files = parseFiles(input.fileUrls)
  if (files.length) {
    properties['Files & media'] = { files }
  }

  if (reporterId) {
    properties['Reported by:'] = { people: [{ id: reporterId }] }
  }

  const result = await notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: INCIDENTS_DATABASE_ID },
      properties,
    }),
  })

  return result as { id: string; url: string; created_time: string }
}

export async function resolveNotionReporter(email: string) {
  try {
    const user = await findNotionUserByEmail(email)
    return user
      ? { id: user.id, name: user.name || email, email: user.person?.email || email }
      : null
  } catch {
    return null
  }
}
