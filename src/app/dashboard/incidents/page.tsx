'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
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

import { Skeleton } from '@/components/ui/skeleton'

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

const today = new Date().toISOString().slice(0, 10)

function badgeClasses(status: string) {
  const s = status.toLowerCase()
  if (s.includes('closed')) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  if (s.includes('escalat')) return 'bg-sky-500/10 text-sky-300 border-sky-500/20'
  if (s.includes('review')) return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
  if (s.includes('await')) return 'bg-orange-500/10 text-orange-300 border-orange-500/20'
  return 'bg-red-500/10 text-red-300 border-red-500/20'
}

function severityClasses(severity: string | null) {
  const s = (severity || '').toLowerCase()
  if (s === 'critical' || s === 'high') return 'bg-red-500/10 text-red-300 border-red-500/20'
  if (s === 'medium') return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
  return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'No date'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCreatedAt(iso: string) {
  const date = new Date(iso)
  return date.toLocaleString('en-IE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function countActiveByStatus(incidents: ActiveIncident[]) {
  return incidents.reduce<Record<string, number>>((acc, incident) => {
    const key = incident.status || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

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
  const highCount = incidents.filter(incident => ['high', 'critical'].includes((incident.severity || '').toLowerCase())).length
  const attachedCount = incidents.reduce((sum, incident) => sum + incident.files.length, 0)
  const initialLoading = loading && incidents.length === 0 && !error

  if (initialLoading) {
    return <IncidentsLoadingSkeleton />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setCreatedUrl(null)

    try {
      const payload = {
        ...form,
        fileUrls: form.fileUrls
          .split(',')
          .map(url => url.trim())
          .filter(Boolean),
      }

      const res = await fetch('/api/notion/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Submit failed: ${res.status}`)

      setSuccess(`Incident submitted to Notion${data.reporterMatched ? ' and linked to your workspace account' : ''}.`)
      setCreatedUrl(data.url || null)
      setForm(prev => ({
        ...prev,
        reportTitle: '',
        incidentTime: '',
        description: '',
        peopleInvolved: '',
        reviewNotes: '',
        fileUrls: '',
      }))
      await fetchData('refresh')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 p-6 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.75)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Incidents</h1>
                <p className="text-sm text-zinc-400">Active incidents pulled live from the Notion incidents database.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-400">
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1">{activeCount} active</span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1">{highCount} high/critical</span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1">{attachedCount} attachments</span>
              {reporter ? (
                <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-sky-300">
                  Reported by: {reporter.name}
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-300">
                  No Notion user match for your portal account yet
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => void fetchData('refresh')}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {success}
            </div>
            {createdUrl && (
              <a
                href={createdUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-200 underline underline-offset-2"
              >
                Open the new Notion incident <Link2 className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active incidents" value={activeCount} tone="red" helper="Still open in Notion" />
        <StatCard label="High / critical" value={highCount} tone="amber" helper="Needs fast attention" />
        <StatCard label="Total attachments" value={attachedCount} tone="sky" helper="Across active incidents" />
        <StatCard label="Status buckets" value={Object.keys(statusCounts).length} tone="emerald" helper="Distinct active statuses" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.85)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Submit a new incident</h2>
              <p className="text-sm text-zinc-400">This mirrors the key Notion database fields so you can add a record from the portal.</p>
            </div>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
              Status will default to Not Reviewed
            </span>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Report title">
                <input
                  value={form.reportTitle}
                  onChange={e => setForm(prev => ({ ...prev, reportTitle: e.target.value }))}
                  placeholder="Short title for the incident"
                  className={inputClass}
                />
              </Field>
              <Field label="Site *">
                <select value={form.site} onChange={e => setForm(prev => ({ ...prev, site: e.target.value }))} className={inputClass} required>
                  <option value="">Choose site</option>
                  {options.sites.map(site => (
                    <option key={site} value={site}>{site}</option>
                  ))}
                </select>
              </Field>
              <Field label="Incident date *">
                <input type="date" value={form.incidentDate} onChange={e => setForm(prev => ({ ...prev, incidentDate: e.target.value }))} className={inputClass} required />
              </Field>
              <Field label="Incident time">
                <input
                  value={form.incidentTime}
                  onChange={e => setForm(prev => ({ ...prev, incidentTime: e.target.value }))}
                  placeholder="e.g. 17:10 or Between 17:05 and 17:10"
                  className={inputClass}
                />
              </Field>
              <Field label="Category *">
                <select value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} className={inputClass} required>
                  <option value="">Choose category</option>
                  {options.categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </Field>
              <Field label="Severity *">
                <select value={form.severity} onChange={e => setForm(prev => ({ ...prev, severity: e.target.value }))} className={inputClass} required>
                  <option value="">Choose severity</option>
                  {options.severities.map(severity => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
                </select>
              </Field>
              <Field label="Likely area *">
                <select value={form.likelyArea} onChange={e => setForm(prev => ({ ...prev, likelyArea: e.target.value }))} className={inputClass} required>
                  <option value="">Choose area</option>
                  {options.areas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </Field>
              <Field label="Files / media URLs">
                <input
                  value={form.fileUrls}
                  onChange={e => setForm(prev => ({ ...prev, fileUrls: e.target.value }))}
                  placeholder="Comma-separated URLs to photos or documents"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="People / staff involved">
              <textarea
                value={form.peopleInvolved}
                onChange={e => setForm(prev => ({ ...prev, peopleInvolved: e.target.value }))}
                rows={3}
                placeholder="Names, roles, witnesses, or people involved"
                className={textareaClass}
              />
            </Field>

            <Field label="Describe what happened: *">
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={6}
                placeholder="Brief factual summary of the incident"
                className={textareaClass}
                required
              />
            </Field>

            <Field label="Review notes">
              <textarea
                value={form.reviewNotes}
                onChange={e => setForm(prev => ({ ...prev, reviewNotes: e.target.value }))}
                rows={3}
                placeholder="Optional notes for the reviewer"
                className={textareaClass}
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-zinc-500">
                <User className="mr-1 inline h-3.5 w-3.5" />
                Notion will stamp the reported-by person automatically when your portal account matches a workspace user.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit to Notion
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.85)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Active incidents</h2>
              <p className="text-sm text-zinc-400">Only non-closed records from the Notion database are shown here.</p>
            </div>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">Live Notion data</span>
          </div>

          <div className="mt-5 space-y-3">
            {loading && incidents.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center text-sm text-zinc-500">
                Loading active incidents...
              </div>
            ) : incidents.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center text-sm text-zinc-500">
                No active incidents found in Notion.
              </div>
            ) : (
              incidents.map(incident => (
                <article key={incident.pageId} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-zinc-700 hover:bg-zinc-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-white">{incident.title}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClasses(incident.status)}`}>
                          {incident.status}
                        </span>
                        {incident.severity && (
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityClasses(incident.severity)}`}>
                            {incident.severity}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {incident.site || 'Unknown site'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(incident.incidentDate)}
                        </span>
                        {incident.incidentTime && (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {incident.incidentTime}
                          </span>
                        )}
                        {incident.daysOpen != null && (
                          <span className="inline-flex items-center gap-1">
                            <BadgeAlert className="h-3.5 w-3.5" />
                            {incident.daysOpen} days open
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-zinc-500">
                      <div>{formatCreatedAt(incident.createdTime)}</div>
                      <a href={incident.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-zinc-400 hover:text-white">
                        Open <Link2 className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                    <MetaLine icon={<Tag className="h-3.5 w-3.5" />} label="Category" value={incident.category || '—'} />
                    <MetaLine icon={<MapPin className="h-3.5 w-3.5" />} label="Likely area" value={incident.likelyArea || '—'} />
                    <MetaLine icon={<User className="h-3.5 w-3.5" />} label="Reported by" value={incident.reportedBy.map(person => person.name).join(', ') || '—'} />
                    <MetaLine icon={<Paperclip className="h-3.5 w-3.5" />} label="Attachments" value={String(incident.files.length)} />
                  </div>

                  {incident.peopleInvolved && (
                    <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs leading-5 text-zinc-300">
                      <span className="mr-2 font-medium text-zinc-500">People / staff involved:</span>
                      {incident.peopleInvolved}
                    </p>
                  )}

                  {incident.reviewNotes && (
                    <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs leading-5 text-zinc-300">
                      <span className="mr-2 font-medium text-zinc-500">Review notes:</span>
                      {incident.reviewNotes}
                    </p>
                  )}

                  {incident.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {incident.files.map(file => (
                        <a
                          key={`${incident.pageId}-${file.name}`}
                          href={file.url || incident.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-600 hover:text-white"
                        >
                          {file.name}
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{status}</div>
            <div className="mt-1 text-lg font-semibold text-white">{count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IncidentsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 p-6 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.75)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl bg-zinc-800" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-36 bg-zinc-800" />
                <Skeleton className="h-4 w-72 bg-zinc-800" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-24 rounded-full bg-zinc-800" />
              <Skeleton className="h-7 w-28 rounded-full bg-zinc-800" />
              <Skeleton className="h-7 w-28 rounded-full bg-zinc-800" />
              <Skeleton className="h-7 w-48 rounded-full bg-zinc-800" />
            </div>
          </div>
          <Skeleton className="h-10 w-28 rounded-xl bg-zinc-800" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <Skeleton className="h-4 w-28 bg-zinc-800" />
            <Skeleton className="mt-3 h-9 w-16 bg-zinc-800" />
            <Skeleton className="mt-2 h-3 w-36 bg-zinc-800" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <Skeleton className="h-6 w-44 bg-zinc-800" />
          <Skeleton className="mt-2 h-4 w-80 bg-zinc-800" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24 bg-zinc-800" />
                <Skeleton className="h-11 w-full rounded-xl bg-zinc-800" />
              </div>
            ))}
            <div className="md:col-span-2 space-y-1.5">
              <Skeleton className="h-3 w-32 bg-zinc-800" />
              <Skeleton className="h-28 w-full rounded-xl bg-zinc-800" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Skeleton className="h-3 w-24 bg-zinc-800" />
              <Skeleton className="h-24 w-full rounded-xl bg-zinc-800" />
            </div>
            <div className="md:col-span-2 flex items-center justify-between gap-3 pt-1">
              <Skeleton className="h-4 w-80 bg-zinc-800" />
              <Skeleton className="h-10 w-36 rounded-xl bg-zinc-800" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <Skeleton className="h-6 w-36 bg-zinc-800" />
          <Skeleton className="mt-2 h-4 w-72 bg-zinc-800" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-56 bg-zinc-800" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded-full bg-zinc-800" />
                      <Skeleton className="h-5 w-16 rounded-full bg-zinc-800" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20 bg-zinc-800" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-lg bg-zinc-800" />
                  ))}
                </div>
                <Skeleton className="h-16 w-full rounded-lg bg-zinc-800" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

function StatCard({ label, value, helper, tone }: { label: string; value: number; helper: string; tone: 'red' | 'amber' | 'sky' | 'emerald' }) {
  const toneClass = {
    red: 'from-red-500/15 to-zinc-950 border-red-500/20 text-red-300',
    amber: 'from-amber-500/15 to-zinc-950 border-amber-500/20 text-amber-300',
    sky: 'from-sky-500/15 to-zinc-950 border-sky-500/20 text-sky-300',
    emerald: 'from-emerald-500/15 to-zinc-950 border-emerald-500/20 text-emerald-300',
  }[tone]

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-[0_15px_40px_-28px_rgba(0,0,0,0.75)] ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{helper}</div>
    </div>
  )
}

function MetaLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
      <span className="text-zinc-500">{icon}</span>
      <span className="text-zinc-500">{label}:</span>
      <span className="truncate text-zinc-200">{value}</span>
    </div>
  )
}

const inputClass = 'w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20'
const textareaClass = `${inputClass} min-h-[96px] resize-y`
