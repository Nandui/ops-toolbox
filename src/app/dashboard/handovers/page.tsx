'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, MapPin, User, Calendar, ClipboardList } from 'lucide-react'
import type { TrailTaskInstance, TrailRecordLog } from '@/lib/trail/client'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { fetchWithTimeout, loadErrorMessage } from '@/lib/fetch'

type PillLevel = 'ok' | 'pending' | 'neutral'

function Pill({ level, label }: { level: PillLevel; label: string }) {
  const colours: Record<PillLevel, string> = {
    ok:      'pill-ok',
    pending: 'pill-info',
    neutral: 'pill-neutral',
  }
  return (
    <span className={`pill-base ${colours[level]}`}>
      {label}
    </span>
  )
}

// ── Record field helpers ───────────────────────────────────────────────────────

type RawField = { id: string; name: string; value: string | number | null; type: string }

function isField(v: unknown): v is RawField {
  return typeof v === 'object' && v !== null && 'id' in v && 'type' in v && 'value' in v
}

function formatFieldValue(field: RawField): string {
  if (field.value == null || field.value === '') return '—'
  if (field.type === 'dateTime' || field.type === 'date') {
    try {
      return new Date(String(field.value)).toLocaleString('en-IE', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    } catch { return String(field.value) }
  }
  return String(field.value)
}

// Collects all { sectionName, fields[] } from a single record object.
// Top-level fields (no section) go under sectionName = ''.
function extractSections(rec: Record<string, unknown>): Array<{ section: string; fields: RawField[] }> {
  const topFields: RawField[] = []
  const sections: Array<{ section: string; fields: RawField[] }> = []

  for (const [key, val] of Object.entries(rec)) {
    if (key === 'hasError' || key === 'lastUpdatedAt') continue
    if (isField(val)) {
      topFields.push(val)
    } else if (typeof val === 'object' && val !== null) {
      const nested: RawField[] = []
      for (const [, nv] of Object.entries(val as Record<string, unknown>)) {
        if (isField(nv)) nested.push(nv)
      }
      if (nested.length) sections.push({ section: key, fields: nested })
    }
  }

  return [
    ...(topFields.length ? [{ section: '', fields: topFields }] : []),
    ...sections,
  ]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HandoversPage() {
  const [handovers, setHandovers] = useState<TrailTaskInstance[]>([])
  const [details, setDetails] = useState<Record<string, TrailRecordLog[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(7)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
      const res = await fetchWithTimeout(`/api/trail/handovers?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setHandovers(data.instances || [])
      setDetails(data.recordLogs || {})
    } catch (err) {
      setError(loadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [fetchData])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-title">Handovers</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="handovers-range" className="sr-only">Date range</label>
          <select
            id="handovers-range"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            aria-label="Refresh handovers"
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive ring-1 ring-inset ring-destructive/20">
          {error}
        </div>
      )}

      {/* ── KPI strip ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total entries',  value: handovers.length },
          { label: 'Completed',      value: handovers.filter(h => !!h.completedDatetime).length },
          { label: 'Pending',        value: handovers.filter(h => !h.completedDatetime).length },
        ].map(({ label, value }) => (
          <article key={label} className="surface-card p-4">
            <div className="text-caption text-muted-foreground">{label}</div>
            <div className="mt-1.5 font-mono text-3xl font-light text-foreground">{value}</div>
          </article>
        ))}
      </div>

      {/* ── List ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-headline text-foreground">Handover log — last {days} days</h2>

        {loading && handovers.length === 0 ? (
          <LoadingState label="Loading handovers…" />
        ) : handovers.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icon={ClipboardList}
              title="No handovers found"
              description={`No handover entries in the last ${days} days.`}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {handovers.map(ho => {
              const logs = details[String(ho.taskInstanceId)] ?? []
              const allSections = logs.flatMap(log =>
                log.records.flatMap(rec => extractSections(rec as unknown as Record<string, unknown>))
              )

              return (
                <article key={ho.taskInstanceId} className="surface-card p-4">

                  <div className="mb-3 flex items-start justify-between gap-4">
                    <span className="text-sm font-medium text-foreground">{ho.taskInstanceName}</span>
                    <Pill level={ho.completedDatetime ? 'ok' : 'pending'} label={ho.completedDatetime ? 'Completed' : 'Pending'} />
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{ho.siteName}</span>
                    <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(ho.dueFromDatetime)}</span>
                    {ho.completedByUserName && (
                      <span className="flex items-center gap-1"><User className="size-3" />{ho.completedByUserName}</span>
                    )}
                    {ho.completedDatetime && (
                      <span className="text-muted-foreground/70">completed {formatDate(ho.completedDatetime)}</span>
                    )}
                  </div>

                  {allSections.length > 0 && (
                    <div className="space-y-4 border-t border-border pt-3">
                      {allSections.map(({ section, fields }) => (
                        <div key={section || '__top__'}>
                          {section && (
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {section}
                            </div>
                          )}
                          <div className="space-y-2">
                            {fields.map(field => (
                              <div key={field.id}>
                                <div className="mb-0.5 text-xs leading-snug text-muted-foreground">{field.name}</div>
                                <div className="text-[13px] leading-snug text-foreground">{formatFieldValue(field)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </article>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
