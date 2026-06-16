'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle, CalendarClock, CheckCircle2, Link2, MapPin, RefreshCw, ShieldAlert, User,
} from 'lucide-react'

// ── Types (mirror src/lib/notion/risk-assessments.ts) ───────────────────────────

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
}

// ── Risk helpers ────────────────────────────────────────────────────────────────

type Tone = 'ok' | 'warning' | 'critical' | 'neutral'

function riskTone(risk: string | null): Tone {
  const r = (risk || '').toLowerCase()
  if (!r) return 'neutral'
  if (/(critical|extreme|severe|very high)/.test(r)) return 'critical'
  if (/(high|major)/.test(r)) return 'warning'
  if (/(medium|moderate|minor)/.test(r)) return 'warning'
  if (/(low|negligible)/.test(r)) return 'ok'
  return 'neutral'
}

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-emerald-300', warning: 'text-amber-300', critical: 'text-red-300', neutral: 'text-white/60',
}
const TONE_BG: Record<Tone, string> = {
  ok: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-300',
  critical: 'bg-red-500/15 text-red-300',
  neutral: 'bg-white/[0.08] text-white/60',
}
const TONE_BAR: Record<Tone, string> = {
  ok: 'bg-emerald-500/60', warning: 'bg-amber-500/60', critical: 'bg-red-500/60', neutral: 'bg-white/20',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Small components ────────────────────────────────────────────────────────────

function Pill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap ${TONE_BG[tone]}`}>
      {label}
    </span>
  )
}

/** Circular completion gauge (SVG donut). */
function CompletionGauge({ complete, total }: { complete: number; total: number }) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0
  const r = 52
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  const tone: Tone = pct >= 80 ? 'ok' : pct >= 50 ? 'warning' : 'critical'
  const stroke = tone === 'ok' ? '#34d399' : tone === 'warning' ? '#fbbf24' : '#f87171'

  return (
    <div className="relative flex size-32 items-center justify-center">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none" stroke={stroke} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 700ms ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-3xl font-light text-white">{pct}%</span>
        <span className="text-caption text-white/40">{complete}/{total}</span>
      </div>
    </div>
  )
}

function DistributionBar({
  rows, total,
}: {
  rows: { label: string; count: number; tone: Tone }[]
  total: number
}) {
  if (total === 0) return <p className="text-caption text-white/30">No data</p>
  return (
    <div className="space-y-2.5">
      {rows.map(({ label, count, tone }) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="text-white/55">{label}</span>
            <span className="font-mono text-white/70">{count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className={`h-full rounded-full ${TONE_BAR[tone]} transition-all duration-500`}
              style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────────

export default function RiskAssessmentsPage() {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([])
  const [meta, setMeta] = useState<RiskMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [siteFilter, setSiteFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'outstanding'>('all')

  const fetchData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    setError(null)
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/notion/risk-assessments', { cache: 'no-store' })
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

  const visible = useMemo(() => {
    return assessments.filter(a => {
      if (siteFilter && a.site !== siteFilter) return false
      if (statusFilter === 'complete' && !a.complete) return false
      if (statusFilter === 'outstanding' && a.complete) return false
      return true
    })
  }, [assessments, siteFilter, statusFilter])

  const completeCount = visible.filter(a => a.complete).length
  const outstanding = visible.length - completeCount
  const overdueCount = visible.filter(a => a.reviewOverdue).length
  const highRiskCount = visible.filter(a => riskTone(a.risk) === 'critical' || /high|major/i.test(a.risk || '')).length

  // Risk distribution (ordered by the meta's detected risk options, then any extras).
  const riskRows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of visible) {
      const key = a.risk || 'Unrated'
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const ordered = [...(meta?.riskOptions ?? [])]
    for (const k of counts.keys()) if (!ordered.includes(k)) ordered.push(k)
    return ordered
      .filter(label => counts.has(label))
      .map(label => ({ label, count: counts.get(label) || 0, tone: riskTone(label) }))
  }, [visible, meta])

  // Completion by site.
  const siteRows = useMemo(() => {
    const sites = new Map<string, { total: number; done: number }>()
    for (const a of visible) {
      const key = a.site || 'Unassigned'
      const cur = sites.get(key) || { total: 0, done: 0 }
      cur.total += 1
      if (a.complete) cur.done += 1
      sites.set(key, cur)
    }
    return [...sites.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([label, { total, done }]) => ({ label, total, done, pct: total ? Math.round((done / total) * 100) : 0 }))
  }, [visible])

  if (loading && assessments.length === 0 && !error) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-52 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-white/[0.045]" />
          ))}
        </div>
        <p className="py-12 text-center text-[15px] text-white/40">Loading risk assessments…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-white/[0.06]">
        <div>
          <h1 className="text-title">Risk Assessments</h1>
          <p className="mt-1 text-callout text-white/50">Completion &amp; risk overview from the Notion register.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

      {!error && assessments.length === 0 && !loading ? (
        <div className="surface-card px-6 py-12 text-center text-[15px] text-white/40">
          No risk assessments found in the Notion database.
        </div>
      ) : (
        <>
          {/* Gauges row */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Completion */}
            <article className="surface-card flex items-center gap-5 p-5">
              <CompletionGauge complete={completeCount} total={visible.length} />
              <div className="space-y-1.5">
                <h2 className="text-headline text-white">Completion</h2>
                <p className="text-caption text-white/40">
                  {completeCount} complete · {outstanding} outstanding
                </p>
                {meta && !meta.hasStatus && (
                  <p className="text-caption text-amber-300/80">No status column detected in Notion.</p>
                )}
                {meta?.completeStatuses?.length ? (
                  <p className="text-caption text-white/30">
                    Counts as done: {meta.completeStatuses.join(', ')}
                  </p>
                ) : null}
              </div>
            </article>

            {/* Risk distribution */}
            <article className="surface-card p-5">
              <h2 className="text-headline text-white">Risk distribution</h2>
              <p className="mb-3 text-caption text-white/40">Across {visible.length} assessments</p>
              <DistributionBar rows={riskRows} total={visible.length} />
            </article>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 content-start">
              <KpiCard icon={<CheckCircle2 className="size-4" />} label="Complete" value={completeCount} tone="ok" />
              <KpiCard icon={<AlertTriangle className="size-4" />} label="Outstanding" value={outstanding} tone={outstanding > 0 ? 'warning' : 'ok'} />
              <KpiCard icon={<ShieldAlert className="size-4" />} label="High / critical" value={highRiskCount} tone={highRiskCount > 0 ? 'critical' : 'ok'} />
              <KpiCard icon={<CalendarClock className="size-4" />} label="Review overdue" value={overdueCount} tone={overdueCount > 0 ? 'critical' : 'ok'} />
            </div>
          </div>

          {/* Completion by site */}
          {siteRows.length > 1 && (
            <section className="surface-card p-5">
              <h2 className="text-headline text-white">Completion by site</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {siteRows.map(s => (
                  <div key={s.label}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="text-white/60">{s.label}</span>
                      <span className="font-mono text-white/70">{s.done}/{s.total} · {s.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${s.pct >= 80 ? 'bg-emerald-500/60' : s.pct >= 50 ? 'bg-amber-500/60' : 'bg-red-500/60'}`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* List */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-headline text-white/80">Assessments</h2>
              <div role="tablist" className="inline-flex rounded-xl bg-white/[0.06] p-1">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'outstanding', label: 'Outstanding' },
                  { id: 'complete', label: 'Complete' },
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
            </div>

            <div className="space-y-2">
              {visible.length === 0 ? (
                <div className="surface-card px-6 py-12 text-center text-[15px] text-white/40">
                  No assessments match the current filters.
                </div>
              ) : visible.map(a => (
                <article key={a.pageId} className="surface-card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm font-medium text-white">{a.title}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {a.risk && <Pill tone={riskTone(a.risk)} label={a.risk} />}
                      {a.status && <Pill tone={a.complete ? 'ok' : 'warning'} label={a.status} />}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-white/40">
                    {a.site && <span className="flex items-center gap-1"><MapPin className="size-3" />{a.site}</span>}
                    {a.category && <span className="flex items-center gap-1">{a.category}</span>}
                    {a.owner && <span className="flex items-center gap-1"><User className="size-3" />{a.owner}</span>}
                    {a.reviewDate && (
                      <span className={`flex items-center gap-1 ${a.reviewOverdue ? 'text-red-300' : ''}`}>
                        <CalendarClock className="size-3" />
                        Review {formatDate(a.reviewDate)}{a.reviewOverdue ? ' · overdue' : ''}
                      </span>
                    )}
                    <a
                      href={a.url} target="_blank" rel="noreferrer"
                      aria-label="Open in Notion"
                      className="ml-auto flex size-6 items-center justify-center rounded text-white/40 hover:text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <Link2 className="size-3" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: Tone }) {
  return (
    <article className="surface-card p-4">
      <div className={`flex items-center gap-1.5 text-caption ${TONE_TEXT[tone]}`}>
        {icon}
        <span className="text-white/40">{label}</span>
      </div>
      <div className="mt-1.5 font-mono text-3xl font-light text-white">{value}</div>
    </article>
  )
}
