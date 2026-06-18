'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle, Building, CalendarClock, CheckCircle2, ChevronRight, ExternalLink,
  Info, MapPin, RefreshCw, Search, ShieldAlert, ShieldCheck, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { DataTable } from '@/components/ui/data-table'
import { StatusPill, inferTone, type PillTone } from '@/components/ui/status-pill'
import { Timeline, type TimelineEntry } from '@/components/ui/timeline'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'

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

// ── Helpers ────────────────────────────────────────────────────────────────────

const RISK_RANK = ['negligible', 'very low', 'low', 'minor', 'medium', 'moderate', 'high', 'major', 'severe', 'critical', 'very high', 'extreme']
function riskRank(risk: string | null): number {
  const r = (risk || '').toLowerCase()
  const i = RISK_RANK.findIndex(x => r.includes(x))
  return i === -1 ? -1 : i
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatDateTime(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleString('en-IE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusTone(a: RiskAssessment): PillTone {
  if (a.complete) return 'ok'
  if (a.reviewOverdue) return 'critical'
  return 'warning'
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

function Kpi({ icon: Icon, label, value, tone }: {
  icon: React.ElementType; label: string; value: number; tone: PillTone
}) {
  const color =
    value === 0 ? 'text-success'
    : tone === 'critical' ? 'text-destructive'
    : tone === 'warning' ? 'text-warning'
    : tone === 'ok' ? 'text-success'
    : 'text-foreground'
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4.5" />
      </div>
      <div>
        <div className={`font-mono text-xl leading-none font-medium ${color}`}>{value}</div>
        <div className="mt-1 text-caption text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

// ── Schema debug (collapsed unless detection gaps) ──────────────────────────────

function SchemaDebug({ meta }: { meta: RiskMeta }) {
  const [open, setOpen] = useState(false)
  const missing = Object.entries(meta.detected).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length === 0) return null
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/8">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-warning focus:outline-none"
      >
        <Info className="size-4 shrink-0" />
        <span className="flex-1">
          Some Notion columns weren&apos;t auto-detected: <strong>{missing.join(', ')}</strong>. Expand for details.
        </span>
        <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-warning/20 px-4 pt-3 pb-4 text-xs text-foreground/70">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {Object.entries(meta.detected).map(([field, col]) => (
              <div key={field} className="contents">
                <dt className="font-mono text-muted-foreground">{field}</dt>
                <dd className={col ? 'text-foreground' : 'text-destructive'}>{col ?? '— not found'}</dd>
              </div>
            ))}
          </dl>
          {meta.allProperties && meta.allProperties.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-foreground">All Notion columns ({meta.allProperties.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {meta.allProperties.map(p => (
                  <span key={p.name} className="rounded bg-muted px-1.5 py-0.5 font-mono">
                    {p.name} <span className="text-muted-foreground">({p.type})</span>
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

// ── Detail drawer ────────────────────────────────────────────────────────────

function MetaRow({ icon: Icon, label, children }: {
  icon: React.ElementType; label: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-caption text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-callout text-foreground">{children}</div>
      </div>
    </div>
  )
}

function DetailDrawer({ item, onClose }: { item: RiskAssessment | null; onClose: () => void }) {
  const a = item
  const timeline: TimelineEntry[] = useMemo(() => {
    if (!a) return []
    const entries: TimelineEntry[] = []
    if (a.reviewDate) {
      entries.push({
        id: 'review',
        title: a.reviewOverdue ? 'Review overdue' : 'Next review due',
        timestamp: formatDate(a.reviewDate) ?? undefined,
        tone: a.reviewOverdue ? 'critical' : 'warning',
        icon: CalendarClock,
        meta: a.reviewOverdue ? 'Past the scheduled review date' : 'Scheduled review date',
      })
    }
    entries.push({
      id: 'status',
      title: a.complete ? 'Marked complete' : `Status: ${a.status ?? 'Not started'}`,
      tone: statusTone(a),
      icon: a.complete ? CheckCircle2 : ShieldAlert,
      meta: a.complete ? 'Assessment signed off' : 'Currently in progress',
    })
    entries.push({
      id: 'edited',
      title: 'Last updated',
      timestamp: formatDateTime(a.lastEdited) ?? undefined,
      tone: 'neutral',
      meta: 'Most recent change in Notion',
    })
    return entries
  }, [a])

  return (
    <Sheet open={!!a} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        {a && (
          <>
            <SheetHeader className="gap-2 border-b border-border p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                {a.risk && <StatusPill label={a.risk} tone={inferTone(a.risk)} />}
                <StatusPill label={a.complete ? 'Complete' : a.reviewOverdue ? 'Overdue' : (a.status ?? 'Outstanding')} tone={statusTone(a)} />
              </div>
              <SheetTitle className="text-title leading-snug text-foreground">{a.title}</SheetTitle>
              <SheetDescription>
                {[a.category, a.site].filter(Boolean).join(' · ') || 'Uncategorised'}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Record fields */}
              <div className="divide-y divide-border">
                <MetaRow icon={MapPin} label="Area">{a.category || 'Uncategorised'}</MetaRow>
                {a.site && <MetaRow icon={Building} label="Site">{a.site}</MetaRow>}
                <MetaRow icon={User} label="Owner">{a.owner || <span className="text-muted-foreground">Unassigned</span>}</MetaRow>
                <MetaRow icon={CalendarClock} label="Review date">
                  {a.reviewDate
                    ? <span className={a.reviewOverdue ? 'text-destructive' : ''}>{formatDate(a.reviewDate)}{a.reviewOverdue ? ' · overdue' : ''}</span>
                    : <span className="text-muted-foreground">Not set</span>}
                </MetaRow>
              </div>

              {/* Activity timeline */}
              <div className="mt-6">
                <h4 className="mb-3 text-subhead text-foreground">Activity</h4>
                <Timeline entries={timeline} />
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border p-4">
              <Button
                variant="primary" size="default" className="w-full"
                render={<a href={a.url} target="_blank" rel="noreferrer" />}
              >
                Open in Notion <ExternalLink className="size-4" />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RiskAssessmentsPage() {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([])
  const [meta, setMeta] = useState<RiskMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'outstanding' | 'complete'>('all')
  const [active, setActive] = useState<RiskAssessment | null>(null)

  const fetchData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    setError(null)
    if (mode === 'initial') setLoading(true); else setRefreshing(true)
    try {
      const res = await fetch('/api/notion/risk-assessments', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`)
      setAssessments(data.assessments || [])
      setMeta(data.meta || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData('initial')
  }, [fetchData])

  // Area options — prefer the detected category options, else derive from data.
  const areaOptions = useMemo(() => {
    const set = new Set<string>()
    for (const a of assessments) if (a.category) set.add(a.category)
    return [...set].sort()
  }, [assessments])

  const visible = useMemo(() => assessments.filter(a => {
    if (siteFilter && a.site !== siteFilter) return false
    if (areaFilter && a.category !== areaFilter) return false
    if (statusFilter === 'complete' && !a.complete) return false
    if (statusFilter === 'outstanding' && a.complete) return false
    return true
  }), [assessments, siteFilter, areaFilter, statusFilter])

  const overdue     = visible.filter(a => a.reviewOverdue).length
  const highRisk    = visible.filter(a => !a.complete && riskRank(a.risk) >= 6).length
  const outstanding = visible.filter(a => !a.complete).length
  const complete    = visible.filter(a => a.complete).length

  const columns = useMemo<ColumnDef<RiskAssessment>[]>(() => [
    {
      accessorKey: 'title',
      header: 'Assessment',
      cell: ({ row }) => {
        const a = row.original
        return (
          <div className="flex items-center gap-2.5">
            {a.complete
              ? <CheckCircle2 className="size-4 shrink-0 text-success" />
              : <ShieldAlert className={`size-4 shrink-0 ${a.reviewOverdue ? 'text-destructive' : 'text-muted-foreground/50'}`} />}
            <span className="font-medium text-foreground">{a.title}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'category',
      header: 'Area',
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || 'Uncategorised'}</span>,
    },
    {
      accessorKey: 'risk',
      header: 'Risk',
      sortingFn: (a, b) => riskRank(a.original.risk) - riskRank(b.original.risk),
      cell: ({ row }) => row.original.risk
        ? <StatusPill label={row.original.risk} tone={inferTone(row.original.risk)} />
        : <span className="text-muted-foreground/60">—</span>,
    },
    {
      id: 'status',
      accessorFn: (r) => (r.complete ? 'complete' : r.reviewOverdue ? 'overdue' : 'outstanding'),
      header: 'Status',
      cell: ({ row }) => {
        const a = row.original
        return <StatusPill label={a.complete ? 'Complete' : a.reviewOverdue ? 'Overdue' : (a.status ?? 'Outstanding')} tone={statusTone(a)} />
      },
    },
    {
      accessorKey: 'owner',
      header: 'Owner',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? <span className="text-muted-foreground">{v}</span> : <span className="text-muted-foreground/50">Unassigned</span>
      },
    },
    {
      accessorKey: 'reviewDate',
      header: 'Review',
      cell: ({ row }) => {
        const a = row.original
        if (!a.reviewDate) return <span className="text-muted-foreground/50">—</span>
        return (
          <span className={`font-mono text-[13px] ${a.reviewOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
            {formatDate(a.reviewDate)}
          </span>
        )
      },
    },
  ], [])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-display text-foreground">Risk Assessments</h1>
          <p className="mt-1 text-callout text-muted-foreground">
            {visible.length > 0
              ? `${complete} of ${visible.length} complete · ${outstanding} outstanding${overdue ? ` · ${overdue} review overdue` : ''}`
              : 'Risk register from Notion'}
          </p>
        </div>
        <Button variant="tertiary" size="sm" onClick={() => void fetchData('refresh')} disabled={loading || refreshing}>
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive ring-1 ring-inset ring-destructive/20">
          {error}
        </div>
      )}

      {meta && <SchemaDebug meta={meta} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={CalendarClock} label="Reviews overdue" value={overdue} tone="critical" />
        <Kpi icon={ShieldAlert} label="High / critical" value={highRisk} tone="warning" />
        <Kpi icon={AlertTriangle} label="Outstanding" value={outstanding} tone="warning" />
        <Kpi icon={CheckCircle2} label="Complete" value={complete} tone="ok" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search assessments…"
            aria-label="Search assessments"
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
        </div>
        <SegmentedControl
          aria-label="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'outstanding', label: 'Outstanding' },
            { value: 'complete', label: 'Complete' },
          ]}
          className="h-9"
        />
        {areaOptions.length > 0 && (
          <Select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="w-auto min-w-[140px]">
            <option value="">All areas</option>
            {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
        )}
        {(meta?.siteOptions?.length ?? 0) > 0 && (
          <Select value={siteFilter} onChange={e => setSiteFilter(e.target.value)} className="w-auto min-w-[140px]">
            <option value="">All sites</option>
            {(meta?.siteOptions ?? []).map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        )}
      </div>

      {/* Table */}
      {loading && assessments.length === 0 ? (
        <div className="surface-card divide-y divide-border p-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : !error && assessments.length === 0 ? (
        <div className="surface-card px-6 py-16 text-center text-[15px] text-muted-foreground">
          <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          No risk assessments found in the Notion database.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          globalFilter={query}
          onRowClick={setActive}
          isRowActive={(r) => r.pageId === active?.pageId}
          emptyMessage="No assessments match the current filters."
        />
      )}

      <DetailDrawer item={active} onClose={() => setActive(null)} />
    </div>
  )
}
