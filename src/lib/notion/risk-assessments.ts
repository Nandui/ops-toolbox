/* eslint-disable @typescript-eslint/no-explicit-any */
// Notion's API returns deeply polymorphic property values (rich_text, select,
// status, people, formula, rollup…). Rather than hard-code this database's
// column names — which we can't see from outside the deployed app — we read the
// database schema at runtime and auto-detect the properties we care about.
import { getSql } from '@/lib/db'

const NOTION_VERSION = '2022-06-28'

// Database id taken from the shared Notion URL:
//   app.notion.com/p/leisureworld/2ea4aed9d363816681c0fac8ce6a72f0?v=…
export const RISK_DATABASE_ID = '2ea4aed9-d363-8166-81c0-fac8ce6a72f0'

// ── Auth (same source as the incidents integration) ─────────────────────────────

async function getApiKey() {
  try {
    const sql = await getSql()
    const rows = await sql`SELECT value FROM system_settings WHERE key = 'notion_api_key'` as { value: string }[]
    if (rows[0]?.value) return rows[0].value
  } catch {
    // DB not reachable — fall back to the env var below.
  }
  const key = process.env.NOTION_API_KEY
  if (!key) throw new Error('Notion API key not configured — set it in Admin → Settings or via the NOTION_API_KEY environment variable.')
  return key
}

async function notionFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getApiKey()}`,
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

// ── Public types ────────────────────────────────────────────────────────────────

export interface RiskAssessment {
  pageId: string
  url: string
  title: string
  status: string | null
  complete: boolean
  risk: string | null
  site: string | null
  category: string | null
  owner: string | null
  reviewDate: string | null
  reviewOverdue: boolean
  lastEdited: string
}

export interface RiskMeta {
  hasStatus: boolean
  hasRisk: boolean
  completeStatuses: string[]   // status option names treated as "complete"
  statusOptions: string[]
  riskOptions: string[]        // ordered low → high where detectable
  siteOptions: string[]
  categoryOptions: string[]
  detected: Record<string, string | null> // which Notion column drove each field
  allProperties: { name: string; type: string }[] // every column in the database for debugging
}

export interface RiskAssessmentsResult {
  assessments: RiskAssessment[]
  meta: RiskMeta
  fetchedAt: string
}

// ── Property accessors ──────────────────────────────────────────────────────────

function plainText(prop: any): string {
  if (!prop) return ''
  if (Array.isArray(prop.title))     return prop.title.map((t: any) => t?.plain_text ?? '').join('')
  if (Array.isArray(prop.rich_text)) return prop.rich_text.map((t: any) => t?.plain_text ?? '').join('')
  return ''
}

function selectValue(prop: any): string | null {
  if (!prop) return null
  if (prop.select?.name) return prop.select.name
  if (prop.status?.name) return prop.status.name
  if (Array.isArray(prop.multi_select) && prop.multi_select.length) {
    return prop.multi_select.map((s: any) => s.name).join(', ')
  }
  if (prop.formula?.string) return prop.formula.string
  return null
}

function peopleValue(prop: any): string | null {
  if (!prop) return null
  if (Array.isArray(prop.people) && prop.people.length) {
    return prop.people.map((p: any) => p?.name ?? p?.person?.email ?? 'Unknown').join(', ')
  }
  const text = plainText(prop)
  return text || selectValue(prop)
}

function dateValue(prop: any): string | null {
  if (!prop) return null
  if (prop.date?.start) return prop.date.start
  if (prop.formula?.date?.start) return prop.formula.date.start
  return null
}

// ── Schema detection ────────────────────────────────────────────────────────────

const RISK_ORDER = ['negligible', 'very low', 'low', 'minor', 'medium', 'moderate', 'high', 'major', 'severe', 'critical', 'very high', 'extreme']

function rankRisk(name: string): number {
  const n = name.toLowerCase()
  const i = RISK_ORDER.findIndex(r => n.includes(r))
  return i === -1 ? 99 : i
}

function firstMatch(names: string[], re: RegExp): string | null {
  return names.find(n => re.test(n)) ?? null
}

/**
 * Reads the database schema and works out which property feeds each field we
 * render, plus the status options that count as "complete".
 */
async function detectSchema() {
  const db = await notionFetch(`/databases/${RISK_DATABASE_ID}`, { method: 'GET' })
  const props: Record<string, any> = db.properties || {}
  const names = Object.keys(props)
  const byType = (type: string) => names.filter(n => props[n]?.type === type)

  const titleProp = byType('title')[0] ?? null

  // Status: prefer a true "status" property, else a select that looks like one.
  const statusType = byType('status')
  const statusProp =
    statusType[0] ??
    firstMatch(byType('select'), /status|state|progress|stage|complete/i) ??
    null

  // Which status option names count as complete?
  let completeStatuses: string[] = []
  let statusOptions: string[] = []
  if (statusProp) {
    const cfg = props[statusProp]
    if (cfg.type === 'status') {
      const options: any[] = cfg.status?.options ?? []
      statusOptions = options.map(o => o.name)
      const groups: any[] = cfg.status?.groups ?? []
      const completeGroup = groups.find(g => /complete|done|finished/i.test(g.name))
      if (completeGroup) {
        const ids: string[] = completeGroup.option_ids ?? []
        completeStatuses = options.filter(o => ids.includes(o.id)).map(o => o.name)
      }
    } else {
      statusOptions = (cfg.select?.options ?? []).map((o: any) => o.name)
    }
    // Fallback / supplement: classify by option name.
    if (completeStatuses.length === 0) {
      completeStatuses = statusOptions.filter(n =>
        /complete|done|approved|signed|reviewed|current|valid|up to date|in date/i.test(n)
      )
    }
  }

  const selectish = [...byType('select'), ...byType('status'), ...byType('multi_select')]
  const riskProp =
    firstMatch(selectish, /risk\s*(level|rating|score)?/i) ??
    firstMatch(selectish, /rating|severity|priority|likelihood/i) ??
    null
  const siteProp = firstMatch([...selectish, ...byType('rich_text')], /site|location|venue|centre|center|facility/i)

  // Category/area: search selects + rich_text, broad pattern to catch "Area", "Section",
  // "Department", "Zone", "Pool", "Hazard Type", "Topic", etc.
  const unusedSelects = selectish.filter(n => n !== riskProp && n !== statusProp && n !== siteProp)
  const categoryProp =
    firstMatch([...unusedSelects, ...byType('rich_text').filter(n => n !== siteProp)],
      /categ|area|section|department|dept|group|zone|pool|hazard|topic|subject|classif/i) ??
    // Last resort: first remaining select column
    unusedSelects[0] ??
    null

  const ownerProp =
    firstMatch(byType('people'), /.*/) ??
    firstMatch([...selectish, ...byType('rich_text')], /owner|assign|responsib|lead|assessor|by/i)

  const reviewProp =
    firstMatch(byType('date'), /review|next|due|expir|valid|renew/i) ??
    byType('date')[0] ??
    firstMatch(byType('formula'), /review|next|due|expir/i) ??
    null

  let riskOptions: string[] = []
  if (riskProp) {
    const cfg = props[riskProp]
    const opts = (cfg.select?.options ?? cfg.status?.options ?? cfg.multi_select?.options ?? []) as any[]
    riskOptions = opts.map(o => o.name).sort((a, b) => rankRisk(a) - rankRisk(b))
  }

  const siteOptions     = optionNames(props[siteProp ?? ''])
  const categoryOptions = optionNames(props[categoryProp ?? ''])

  const allProperties = names.map(n => ({ name: n, type: props[n]?.type ?? 'unknown' }))

  return {
    props,
    titleProp, statusProp, riskProp, siteProp, categoryProp, ownerProp, reviewProp,
    completeStatuses, statusOptions, riskOptions, siteOptions, categoryOptions,
    allProperties,
  }
}

function optionNames(cfg: any): string[] {
  if (!cfg) return []
  return (cfg.select?.options ?? cfg.status?.options ?? cfg.multi_select?.options ?? []).map((o: any) => o.name)
}

// ── Fetch + parse ────────────────────────────────────────────────────────────────

export async function fetchRiskAssessments(): Promise<RiskAssessmentsResult> {
  const schema = await detectSchema()
  const completeSet = new Set(schema.completeStatuses.map(s => s.toLowerCase()))
  const today = new Date().toISOString().slice(0, 10)

  const pages: any[] = []
  let cursor: string | null = null
  do {
    const body: Record<string, any> = { page_size: 100 }
    if (cursor) body.start_cursor = cursor
    const data = await notionFetch(`/databases/${RISK_DATABASE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    pages.push(...(data.results || []))
    cursor = data.has_more ? data.next_cursor : null
  } while (cursor)

  const assessments: RiskAssessment[] = pages.map((page: any) => {
    const p = page.properties || {}
    const status = schema.statusProp ? selectValue(p[schema.statusProp]) : null
    const reviewDate = schema.reviewProp ? dateValue(p[schema.reviewProp]) : null
    const complete = status ? completeSet.has(status.toLowerCase()) : false

    return {
      pageId: page.id,
      url: page.url,
      title: (schema.titleProp ? plainText(p[schema.titleProp]) : '') || 'Untitled assessment',
      status,
      complete,
      risk: schema.riskProp ? selectValue(p[schema.riskProp]) : null,
      site: schema.siteProp ? (selectValue(p[schema.siteProp]) || plainText(p[schema.siteProp]) || null) : null,
      category: schema.categoryProp ? selectValue(p[schema.categoryProp]) : null,
      owner: schema.ownerProp ? peopleValue(p[schema.ownerProp]) : null,
      reviewDate,
      reviewOverdue: !complete && reviewDate !== null && reviewDate < today,
      lastEdited: page.last_edited_time || page.created_time,
    }
  })

  return {
    assessments,
    meta: {
      hasStatus: Boolean(schema.statusProp),
      hasRisk: Boolean(schema.riskProp),
      completeStatuses: schema.completeStatuses,
      statusOptions: schema.statusOptions,
      riskOptions: schema.riskOptions,
      siteOptions: schema.siteOptions,
      categoryOptions: schema.categoryOptions,
      detected: {
        title: schema.titleProp,
        status: schema.statusProp,
        risk: schema.riskProp,
        site: schema.siteProp,
        category: schema.categoryProp,
        owner: schema.ownerProp,
        reviewDate: schema.reviewProp,
      },
      allProperties: schema.allProperties,
    },
    fetchedAt: new Date().toISOString(),
  }
}
