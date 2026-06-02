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
      ? 'text-green-400 border-green-600/40 bg-green-500/10'
      : level === 'warning'
      ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
      : level === 'critical'
      ? 'text-red-400 border-red-600/40 bg-red-500/10'
      : 'text-slate-500 border-slate-700 bg-transparent'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 border text-[10px] font-mono tracking-widest uppercase whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
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

  const statusCounts = useMemo(() => countActiveByStatus(incidents), [incidents])
  const activeCount = incidents.length
  const highCount = incidents.filter(i => ['high', 'critical'].includes((i.severity || '').toLowerCase())).length
  const attachedCount = incidents.reduce((sum, i) => sum + i.files.length, 0)

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
      await fetchData('refresh')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && incidents.length === 0 && !error) {
    return (
      <div className="space-y-8">
        <div className="pb-4 border-b border-white/10">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Operations console</div>
          <div className="h-8 w-48 bg-white/[0.04] animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-white/[0.08] bg-white/[0.03] p-4 h-20 animate-pulse" />
          ))}
        </div>
        <div className="text-sm text-slate-500 font-mono text-center py-12">Loading incidents…</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-white/10">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Operations console</div>
          <h1 className="text-3xl font-light text-white leading-tight">Incident log</h1>
          <p className="mt-1 text-sm text-slate-400">
            Active incidents pulled live from Notion.
            {reporter
              ? <span className="ml-2 text-slate-500">Reporting as <span className="text-slate-300">{reporter.name}</span></span>
              : <span className="ml-2 text-yellow-500/80">No Notion user match for your portal account</span>
            }
          </p>
        </div>
        <button
          onClick={() => void fetchData('refresh')}
          disabled={loading || refreshing}
          className="flex items-center gap-2 border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 hover:border-white/20 hover:text-white disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300 font-mono">{error}</div>
      )}
      {success && (
        <div className="border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300 font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
          {createdUrl && (
            <a href={createdUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-green-200 underline underline-offset-2">
              Open in Notion <Link2 className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* ── KPI strip ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Overview</div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Active incidents', value: activeCount, level: activeCount > 0 ? 'critical' : 'ok' as PillLevel },
            { label: 'High / critical', value: highCount, level: highCount > 0 ? 'critical' : 'ok' as PillLevel },
            { label: 'Status buckets', value: Object.keys(statusCounts).length, level: 'neutral' as PillLevel },
            { label: 'Attachments', value: attachedCount, level: 'neutral' as PillLevel },
          ].map(({ label, value }) => (
            <article key={label} className="border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-2">{label}</div>
              <div className="font-mono text-3xl font-light text-white">{value}</div>
            </article>
          ))}
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">

        {/* Submit form */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Submit incident</div>
          <div className="border border-white/[0.08] bg-white/[0.03] p-5 space-y-4">
            <p className="text-xs text-slate-500">Creates a new record in the Notion incidents database. Status defaults to Not Reviewed.</p>

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

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[10px] font-mono text-slate-600 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Reporter auto-matched from your portal account
                </p>
                <button type="submit" disabled={submitting}
                  className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-mono text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-colors">
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit to Notion
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Active incidents list */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Active incidents</div>
          <div className="space-y-2">
            {incidents.length === 0 ? (
              <div className="border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm text-slate-500 font-mono">
                No active incidents in Notion
              </div>
            ) : incidents.map(incident => (
              <article key={incident.pageId} className="border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{incident.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {incident.severity && (
                      <Pill level={severityLevel(incident.severity)} label={incident.severity} />
                    )}
                    <Pill level={statusLevel(incident.status)} label={incident.status} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono mb-2">
                  {incident.site && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{incident.site}</span>
                  )}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(incident.incidentDate)}</span>
                  {incident.incidentTime && (
                    <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" />{incident.incidentTime}</span>
                  )}
                  {incident.daysOpen != null && (
                    <span className="flex items-center gap-1"><BadgeAlert className="w-3 h-3" />{incident.daysOpen}d open</span>
                  )}
                  <span className="flex items-center gap-1 ml-auto text-slate-600">
                    {formatCreatedAt(incident.createdTime)}
                    <a href={incident.url} target="_blank" rel="noreferrer" className="ml-1 text-slate-500 hover:text-slate-300">
                      <Link2 className="w-3 h-3" />
                    </a>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <MetaLine icon={<Tag className="w-3 h-3" />} label="Category" value={incident.category || '—'} />
                  <MetaLine icon={<MapPin className="w-3 h-3" />} label="Area" value={incident.likelyArea || '—'} />
                  <MetaLine icon={<User className="w-3 h-3" />} label="Reported by" value={incident.reportedBy.map(p => p.name).join(', ') || '—'} />
                  <MetaLine icon={<Paperclip className="w-3 h-3" />} label="Files" value={String(incident.files.length)} />
                </div>

                {incident.peopleInvolved && (
                  <p className="mt-2 text-[11px] font-mono text-slate-400 border-t border-white/[0.06] pt-2">
                    <span className="text-slate-600">People involved · </span>{incident.peopleInvolved}
                  </p>
                )}
                {incident.reviewNotes && (
                  <p className="mt-1.5 text-[11px] font-mono text-slate-400">
                    <span className="text-slate-600">Review notes · </span>{incident.reviewNotes}
                  </p>
                )}
                {incident.files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {incident.files.map(file => (
                      <a key={`${incident.pageId}-${file.name}`} href={file.url || incident.url}
                        target="_blank" rel="noreferrer"
                        className="text-[10px] font-mono text-slate-400 border border-white/[0.08] px-2 py-0.5 hover:text-slate-200 transition-colors">
                        {file.name}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* ── Status breakdown ──────────────────────────────────────────────────── */}
      {Object.keys(statusCounts).length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">By status</div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {Object.entries(statusCounts).map(([status, count]) => (
              <article key={status} className="border border-white/[0.08] bg-white/[0.03] p-3 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{status}</span>
                <span className="font-mono text-lg text-white">{count}</span>
              </article>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function MetaLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-500">
      {icon}
      <span className="text-slate-600">{label}:</span>
      <span className="text-slate-300 truncate">{value}</span>
    </div>
  )
}

const inputClass = 'w-full border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 font-mono'
const textareaClass = `${inputClass} min-h-[80px] resize-y`
