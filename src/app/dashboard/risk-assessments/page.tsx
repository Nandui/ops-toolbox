'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronRight,
  ExternalLink, Info, RefreshCw, ShieldAlert, User,
} from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'

// ── Types ────────────────────────────────────────────────────────────────────────

interface RiskAssessment {
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

interface RiskMeta {
  hasStatus: boolean
  hasRisk: boolean
  completeStatuses: string[]
  statusOptions: string[]
  riskOptions: string[]
  siteOptions: string[]
  categoryOptions: string[]
  detected: Record<string, string | null>
  allProperties?: { name: string; type: string }[]
}

// ── Risk helpers ─────────────────────────────────────────────────────────────────

type Tone = 'ok' | 'warning' | 'critical' | 'neutral'

function riskTone(risk: string | null): Tone {
  const r = (risk || '').toLowerCase()
  if (!r) return 'neutral'
  if (/(critical|extreme|severe|very high)/.test(r)) return 'critical'
  if (/(high|major|medium|moderate|minor)/.test(r)) return 'warning'
  if (/(low|negligible)/.test(r)) return 'ok'
  return 'neutral'
}

const TONE_BG: Record<Tone, string> = {
  ok:       'bg-emerald-500/15 text-emerald-300',
  warning:  'bg-amber-500/15 text-amber-300',
  critical: 'bg-red-500/15 text-red-300',
  neutral:  'bg-white/[0.08] text-white/60',
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Pill ─────────────────────────────────────────────────────────────────────────

function Pill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap ${TONE_BG[tone]}`}>
      {label}
    </span>
  )
}

// ── Schema debug panel ───────────────────────────────────────────────────────────

function SchemaDebug({ meta }: { meta: RiskMeta }) {
  const [open, setOpen] = useState(false)
  const missing = Object.entries(meta.detected).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length === 0) return null // all fields detected, no need to show

  return (
    <div className="rounded-xl bg-amber-500/10 ring-1 ring-inset ring-amber-500/20">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-amber-300 focus:outline-none"
      >
        <Info className="size-4 shrink-0" />
        <span className="flex-1">
          Some Notion columns could not be auto-detected: <strong>{missing.join(', ')}</strong>. Expand for details.
        </span>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
      {open && (
        <div className="border-t border-amber-500/15 px-4 pb-4 pt-3 space-y-3 text-xs text-amber-200/70">
          <div>
            <p className="mb-1 font-semibold text-amber-200">Detected mappings</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {Object.entries(meta.detected).map(([field, col]) => (
                <>
                  <dt key={`${field}-k`} className="font-mono text-amber-300/60">{field}</dt>
                  <dd key={`${field}-v`} className={col ? 'text-amber-100' : 'text-red-300/80'}>{col ?? '— not found'}</dd>
                </>
              ))}
            </dl>
          </div>
          {meta.allProperties && meta.allProperties.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-amber-200">All Notion columns ({meta.allProperties.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {meta.allProperties.map(p => (
                  <span key={p.name} className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono">
                    {p.name} <span className="text-white/30">({p.type})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Area section ─────────────────────────────────────────────────────────────────

function AreaSection({ area, items }: { area: string; items: RiskAssessment[] }) {
  const [open, setOpen] = useState(true)
  const done  = items.filter(a => a.complete).length
  const total = items.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  const barColor =
    pct >= 80 ? 'bg-emerald-500/60'
    : pct >= 50 ? 'bg-amber-500/60'
    : 'bg-red-500/60'

  return (
    <section className="surface-card overflow-hidden">
      {/* Area header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.025] focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-expanded={open}
      >
        <span className="text-white/30">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
        <span className="flex-1 text-sm font-semibold text-white">{area}</span>
        {/* Mini progress bar */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.08]">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="min-w-[6ch] text-right font-mono text-[12px] text-white/40">
            {done}/{total}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {done === total && total > 0
            ? <CheckCircle2 className="size-4 text-emerald-400" />
            : total - done > 0
              ? <AlertTriangle className="size-4 text-amber-400/70" />
              : null}
          <span className="text-caption text-white/30 sm:hidden">{done}/{total}</span>
        </div>
      </button>

      {/* Assessment rows */}
      {open && (
        <div className="border-t border-white/[0.06]">
          {items.map((a, idx) => (
            <div
              key={a.pageId}
              className={`flex items-start gap-3 px-4 py-3 ${idx < items.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
            >
              {/* Status dot */}
              <div className="mt-0.5 shrink-0">
                {a.complete
                  ? <CheckCircle2 className="size-4 text-emerald-400" />
                  : <ShieldAlert className={`size-4 ${a.reviewOverdue ? 'text-red-400' : 'text-white/25'}`} />}
              </div>

              {/* Title + meta */}
              <div className="min-w-0 flex-1">
                <p className={`text-[13.5px] font-medium leading-snug ${a.complete ? 'text-white/60' : 'text-white'}`}>
                  {a.title}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-white/35">
                  {a.owner && (
                    <span className="flex items-center gap-1">
                      <User className="size-3" />{a.owner}
                    </span>
                  )}
                  {a.reviewDate && (
                    <span className={`flex items-center gap-1 ${a.reviewOverdue ? 'text-red-300' : ''}`}>
                      <CalendarClock className="size-3" />
                      Review {formatDate(a.reviewDate)}{a.reviewOverdue ? ' · overdue' : ''}
                    </span>
                  )}
                  {a.status && !a.complete && (
                    <span className="text-white/30">{a.status}</span>
                  )}
                </div>
              </div>

              {/* Pills + link */}
              <div className="flex shrink-0 items-center gap-1.5">
                {a.risk && <Pill tone={riskTone(a.risk)} label={a.risk} />}
                <a
                  href={a.url} target="_blank" rel="noreferrer"
                  aria-label="Open in Notion"
                  onClick={e => e.stopPropagation()}
                  className="flex size-6 items-center justify-center rounded text-white/25 hover:text-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────────

export default function RiskAssessmentsPage() {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([])
  const [meta,        setMeta]        = useState<RiskMeta | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const [siteFilter,   setSiteFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'outstanding'>('all')

  const fetchData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    setError(null)
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    try {
      const res  = await fetch('/api/notion/risk-assessments', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`)
      setAssessments(data.assessments || [])
      setMeta(data.meta || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData('initial')
  }, [fetchData])

  // Apply filters
  const visible = useMemo(() => assessments.filter(a => {
    if (siteFilter && a.site !== siteFilter) return false
    if (statusFilter === 'complete'    && !a.complete)  return false
    if (statusFilter === 'outstanding' &&  a.complete)  return false
    return true
  }), [assessments, siteFilter, statusFilter])

  // Group by area (category), preserving Notion order within each group
  const areaGroups = useMemo(() => {
    const map = new Map<string, RiskAssessment[]>()
    for (const a of visible) {
      const key = a.category || 'Uncategorised'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    // Sort areas: areas with outstanding items first, then by name
    return [...map.entries()].sort(([aName, aItems], [bName, bItems]) => {
      const aOutstanding = aItems.filter(x => !x.complete).length
      const bOutstanding = bItems.filter(x => !x.complete).length
      if (aOutstanding !== bOutstanding) return bOutstanding - aOutstanding
      return aName.localeCompare(bName)
    })
  }, [visible])

  const totalDone        = visible.filter(a => a.complete).length
  const totalOutstanding = visible.length - totalDone
  const overdueCount     = visible.filter(a => a.reviewOverdue).length

  if (loading && assessments.length === 0 && !error) {
    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-white/[0.06]">
          <div className="h-7 w-52 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-white/[0.04]" />
        </div>
        <LoadingState label="Loading risk assessments…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-white/[0.06]">
        <div>
          <h1 className="text-title">Risk Assessments</h1>
          <p className="mt-1 text-callout text-white/50">
            {visible.length > 0
              ? `${totalDone} of ${visible.length} complete · ${totalOutstanding} outstanding${overdueCount > 0 ? ` · ${overdueCount} review overdue` : ''}`
              : 'Risk register from Notion'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status tabs */}
          <div role="tablist" className="inline-flex rounded-xl bg-white/[0.06] p-1">
            {([
              { id: 'all',         label: 'All' },
              { id: 'outstanding', label: 'Outstanding' },
              { id: 'complete',    label: 'Complete' },
            ] as const).map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={statusFilter === t.id}
                onClick={() => setStatusFilter(t.id)}
                className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                  statusFilter === t.id
                    ? 'bg-white/[0.12] font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Site filter */}
          {(meta?.siteOptions?.length ?? 0) > 0 && (
            <>
              <label htmlFor="ra-site" className="sr-only">Site</label>
              <select
                id="ra-site"
                value={siteFilter}
                onChange={e => setSiteFilter(e.target.value)}
                className="h-9 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="">All sites</option>
                {(meta?.siteOptions ?? []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          )}

          {/* Refresh */}
          <button
            onClick={() => void fetchData('refresh')}
            disabled={loading || refreshing}
            aria-label="Refresh risk assessments"
            className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-white/50 hover:text-white disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
          {error}
        </div>
      )}

      {/* Schema debug panel — shows which Notion columns were auto-detected */}
      {meta && <SchemaDebug meta={meta} />}

      {!error && assessments.length === 0 && !loading ? (
        <div className="surface-card px-6 py-12 text-center text-[15px] text-white/40">
          No risk assessments found in the Notion database.
        </div>
      ) : visible.length === 0 ? (
        <div className="surface-card px-6 py-12 text-center text-[15px] text-white/40">
          No assessments match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {areaGroups.map(([area, items]) => (
            <AreaSection key={area} area={area} items={items} />
          ))}
        </div>
      )}
    </div>
  )
}
