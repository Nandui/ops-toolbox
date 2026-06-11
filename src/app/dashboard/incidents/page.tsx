'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  BadgeAlert,
  Calendar,
  CheckCircle2,
  Clock3,
  Link2,
  MapPin,
  Paperclip,
  RefreshCw,
  Send,
  Tag,
  User,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type IncidentOptionSet = {
  sites: string[]
  categories: string[]
  severities: string[]
  areas: string[]
}

type ActiveIncident = {
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

type IncidentsApiResponse = {
  incidents: ActiveIncident[]
  options: IncidentOptionSet
  reporter: { id: string; name: string; email: string } | null
  fetchedAt: string
}

type FormState = {
  reportTitle: string
  site: string
  incidentDate: string
  incidentTime: string
  category: string
  severity: string
  likelyArea: string
  description: string
  peopleInvolved: string
  reviewNotes: string
  fileUrls: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)

function statusLevel(status: string): 'ok' | 'warning' | 'critical' | 'neutral' {
  const s = status.toLowerCase()
  if (s.includes('closed')) return 'ok'
  if (s.includes('escalat')) return 'warning'
  if (s.includes('review') || s.includes('await')) return 'warning'
  return 'critical'
}

function severityLevel(severity: string | null): 'critical' | 'warning' | 'ok' {
  const s = (severity || '').toLowerCase()
  if (s === 'critical' || s === 'high') return 'critical'
  if (s === 'medium') return 'warning'
  return 'ok'
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'No date'
  return new Date(dateString).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCreatedAt(iso: string) {
  return new Date(iso).toLocaleString('en-IE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function countActiveByStatus(incidents: ActiveIncident[]) {
  return incidents.reduce<Record<string, number>>((acc, inc) => {
    const key = inc.status || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

// ── Shared primitives matching chemistry page ─────────────────────────────────

type PillLevel = 'ok' | 'warning' | 'critical' | 'neutral'

function Pill({ level, label }: { level: PillLevel; label: string }) {
  const cls =
    level === 'ok'
      ? 'bg-emerald-500/15 text-emerald-300'
      : level === 'warning'
      ? 'bg-amber-500/15 text-amber-300'
      : level === 'critical'
      ? 'bg-red-500/15 text-red-300'
      : 'bg-white/[0.08] text-white/60'
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

type Tab = 'active' | 'submit'

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const [tab, setTab] = useState<Tab>('active')
  const [siteFilter, setSiteFilter] = useState<string>('')
  const [incidents, setIncidents] = useState<ActiveIncident[]>([])
  const [options, setOptions] = useState<IncidentOptionSet>({ sites: [], categories: [], severities: [], areas: [] })
  const [reporter, setReporter] = useState<IncidentsApiResponse['reporter']>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    reportTitle: '',
    site: '',
    incidentDate: today,
    incidentTime: '',
    category: '',
    severity: '',
    likelyArea: '',
    description: '',
    peopleInvolved: '',
    reviewNotes: '',
    fileUrls: '',
  })

  const fetchData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    setError(null)
    setSuccess(null)
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/notion/incidents', { cache: 'no-store' })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data: IncidentsApiResponse = await res.json()
      setIncidents(data.incidents || [])
      setOptions(data.options || { sites: [], categories: [], severities: [], areas: [] })
      setReporter(data.reporter)
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

  const visibleIncidents = useMemo(
    () => siteFilter ? incidents.filter(i => i.site === siteFilter) : incidents,
    [incidents, siteFilter]
  )
  const statusCounts = useMemo(() => countActiveByStatus(visibleIncidents), [visibleIncidents])
  const activeCount = visibleIncidents.length
  const highCount = visibleIncidents.filter(i => ['high', 'critical'].includes((i.severity || '').toLowerCase())).length
  const attachedCount = visibleIncidents.reduce((sum, i) => sum + i.files.length, 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setCreatedUrl(null)
    try {
      const payload = {
        ...form,
        fileUrls: form.fileUrls.split(',').map(u => u.trim()).filter(Boolean),
      }
      const res = await fetch('/api/notion/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Submit failed: ${res.status}`)
      setSuccess(`Incident submitted to Notion${data.reporterMatched ? ' and linked to your account' : ''}.`)
      setCreatedUrl(data.url || null)
      setForm(prev => ({ ...prev, reportTitle: '', incidentTime: '', description: '', peopleInvolved: '', reviewNotes: '', fileUrls: '' }))
      setTab('active')
      await fetchData('refresh')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && incidents.length === 0 && !error) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.045]" />
          ))}
        </div>
        <p className="py-12 text-center text-[15px] text-white/40">Loading incidents…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-title">Incidents</h1>
        {tab === 'active' && (
          <div className="flex items-center gap-2">
            <label htmlFor="incidents-site" className="sr-only">Site</label>
            <select
              id="incidents-site"
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-white font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="">All sites</option>
              {options.sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => void fetchData('refresh')}
              disabled={loading || refreshing}
              aria-label="Refresh incidents"
              className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-white/50 hover:text-white disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Incident views" className="inline-flex rounded-xl bg-white/[0.06] p-1">
        {([
          { id: 'active', label: 'Active incidents' },
          { id: 'submit', label: 'Submit incident' },
        ] as const).map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => { setTab(t.id); setError(null); setSuccess(null) }}
            className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              tab === t.id
                ? 'bg-white/[0.12] font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────────────── */}
      {error && (
        <div role="alert" aria-live="polite" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">{error}</div>
      )}
      {success && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
          <CheckCircle2 className="size-4 shrink-0" />
          {success}
          {createdUrl && (
            <a href={createdUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-emerald-200 underline underline-offset-2">
              Open in Notion <Link2 className="size-3" />
            </a>
          )}
        </div>
      )}

      {/* ── Active incidents tab ──────────────────────────────────────────────── */}
      {tab === 'active' && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Active incidents', value: activeCount },
              { label: 'High / critical',  value: highCount  },
              { label: 'Status buckets',   value: Object.keys(statusCounts).length },
              { label: 'Attachments',      value: attachedCount },
            ].map(({ label, value }) => (
              <article key={label} className="surface-card p-4">
                <div className="text-caption text-white/40">{label}</div>
                <div className="mt-1.5 font-mono text-3xl font-light text-white">{value}</div>
              </article>
            ))}
          </div>

          {/* Incidents list */}
          <div>
            <div className="space-y-2">
              {visibleIncidents.length === 0 ? (
                <div className="surface-card px-6 py-12 text-center text-[15px] text-white/40">
                  {siteFilter ? `No active incidents for ${siteFilter}` : 'No active incidents in Notion'}
                </div>
              ) : visibleIncidents.map(incident => (
                <article key={incident.pageId} className="surface-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-medium text-white min-w-0 flex-1">{incident.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {incident.severity && <Pill level={severityLevel(incident.severity)} label={incident.severity} />}
                      <Pill level={statusLevel(incident.status)} label={incident.status} />
                    </div>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-white/40">
                    {incident.site && <span className="flex items-center gap-1"><MapPin className="size-3" />{incident.site}</span>}
                    <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(incident.incidentDate)}</span>
                    {incident.incidentTime && <span className="flex items-center gap-1"><Clock3 className="size-3" />{incident.incidentTime}</span>}
                    {incident.daysOpen != null && <span className="flex items-center gap-1"><BadgeAlert className="size-3" />{incident.daysOpen}d open</span>}
                    <span className="ml-auto flex items-center gap-1 text-white/30">
                      {formatCreatedAt(incident.createdTime)}
                      <a href={incident.url} target="_blank" rel="noreferrer" aria-label="Open incident in Notion" className="ml-1 flex size-6 items-center justify-center rounded text-white/40 hover:text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                        <Link2 className="size-3" />
                      </a>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                    <MetaLine icon={<Tag className="size-3" />} label="Category" value={incident.category || '—'} />
                    <MetaLine icon={<MapPin className="size-3" />} label="Area" value={incident.likelyArea || '—'} />
                    <MetaLine icon={<User className="size-3" />} label="Reported by" value={incident.reportedBy.map(p => p.name).join(', ') || '—'} />
                    <MetaLine icon={<Paperclip className="size-3" />} label="Files" value={String(incident.files.length)} />
                  </div>

                  {incident.peopleInvolved && (
                    <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs text-white/55">
                      <span className="text-white/35">People involved · </span>{incident.peopleInvolved}
                    </p>
                  )}
                  {incident.reviewNotes && (
                    <p className="mt-1.5 text-xs text-white/55">
                      <span className="text-white/35">Review notes · </span>{incident.reviewNotes}
                    </p>
                  )}
                  {incident.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {incident.files.map(file => (
                        <a key={`${incident.pageId}-${file.name}`} href={file.url || incident.url}
                          target="_blank" rel="noreferrer"
                          className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/55 hover:bg-white/[0.09] hover:text-white/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                          {file.name}
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>

          {/* Status breakdown */}
          {Object.keys(statusCounts).length > 0 && (
            <div className="space-y-2">
              <h2 className="text-headline text-white/80">By status</h2>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <article key={status} className="surface-card flex items-center justify-between p-3">
                    <span className="text-caption text-white/45">{status}</span>
                    <span className="font-mono text-lg text-white">{count}</span>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Submit incident tab ───────────────────────────────────────────────── */}
      {tab === 'submit' && (
        <div className="space-y-3">
          <h2 className="text-headline text-white/80">New incident report</h2>
          <div className="surface-card space-y-4 p-5">
            <p className="text-callout text-white/45">
              Creates a new record in the Notion incidents database. Status defaults to Not Reviewed.
              {reporter
                ? <span className="ml-1">Reporting as <span className="text-white/75">{reporter.name}</span>.</span>
                : <span className="ml-1 text-amber-300/80">No Notion user match for your portal account.</span>
              }
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Report title">
                  <input value={form.reportTitle} onChange={e => setForm(p => ({ ...p, reportTitle: e.target.value }))}
                    placeholder="Short title" className={inputClass} />
                </Field>
                <Field label="Site *">
                  <select value={form.site} onChange={e => setForm(p => ({ ...p, site: e.target.value }))} className={inputClass} required>
                    <option value="">Choose site</option>
                    {options.sites.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Incident date *">
                  <input type="date" value={form.incidentDate} onChange={e => setForm(p => ({ ...p, incidentDate: e.target.value }))} className={inputClass} required />
                </Field>
                <Field label="Incident time">
                  <input value={form.incidentTime} onChange={e => setForm(p => ({ ...p, incidentTime: e.target.value }))}
                    placeholder="e.g. 17:10" className={inputClass} />
                </Field>
                <Field label="Category *">
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputClass} required>
                    <option value="">Choose category</option>
                    {options.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Severity *">
                  <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))} className={inputClass} required>
                    <option value="">Choose severity</option>
                    {options.severities.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Likely area *">
                  <select value={form.likelyArea} onChange={e => setForm(p => ({ ...p, likelyArea: e.target.value }))} className={inputClass} required>
                    <option value="">Choose area</option>
                    {options.areas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="File URLs">
                  <input value={form.fileUrls} onChange={e => setForm(p => ({ ...p, fileUrls: e.target.value }))}
                    placeholder="Comma-separated URLs" className={inputClass} />
                </Field>
              </div>

              <Field label="People / staff involved">
                <textarea value={form.peopleInvolved} onChange={e => setForm(p => ({ ...p, peopleInvolved: e.target.value }))}
                  rows={2} placeholder="Names, roles, witnesses" className={textareaClass} />
              </Field>
              <Field label="What happened *">
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={5} placeholder="Factual summary of the incident" className={textareaClass} required />
              </Field>
              <Field label="Review notes">
                <textarea value={form.reviewNotes} onChange={e => setForm(p => ({ ...p, reviewNotes: e.target.value }))}
                  rows={2} placeholder="Optional notes for the reviewer" className={textareaClass} />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="flex items-center gap-1 text-caption text-white/35">
                  <User className="size-3" />
                  Reporter auto-matched from your portal account
                </p>
                <button type="submit" disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                  {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  Submit to Notion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-caption text-white/50">{label}</span>
      {children}
    </label>
  )
}

function MetaLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-white/40">
      {icon}
      <span className="text-white/35">{label}:</span>
      <span className="truncate text-white/70">{value}</span>
    </div>
  )
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
const textareaClass = `${inputClass} min-h-[80px] resize-y`
