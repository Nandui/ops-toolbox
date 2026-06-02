'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, MapPin, User, Calendar } from 'lucide-react'
import type { TrailTaskInstance, TrailRecordLog } from '@/lib/trail/client'

type PillLevel = 'ok' | 'pending' | 'neutral'

function Pill({ level, label }: { level: PillLevel; label: string }) {
  const colours: Record<PillLevel, string> = {
    ok:      'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    pending: 'border-blue-500/30    bg-blue-500/10    text-blue-300',
    neutral: 'border-white/10       bg-white/[0.03]   text-slate-400',
  }
  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase whitespace-nowrap ${colours[level]}`}>
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
      const res = await fetch(`/api/trail/handovers?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setHandovers(data.instances || [])
      setDetails(data.recordLogs || {})
    } catch (err) {
      setError(String(err))
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Operations console</div>
          <h1 className="text-3xl font-light text-white">Duty manager handovers</h1>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/20"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="border border-white/10 bg-slate-900/80 p-2 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-mono text-red-400">
          {error}
        </div>
      )}

      {/* ── KPI strip ──────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Overview</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total entries',  value: handovers.length },
            { label: 'Completed',      value: handovers.filter(h => !!h.completedDatetime).length },
            { label: 'Pending',        value: handovers.filter(h => !h.completedDatetime).length },
          ].map(({ label, value }) => (
            <article key={label} className="border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-2">{label}</div>
              <div className="font-mono text-3xl font-light text-white">{value}</div>
            </article>
          ))}
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">
          Handover log — last {days} days
        </div>

        {loading && handovers.length === 0 ? (
          <div className="border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm font-mono text-slate-500">
            Loading…
          </div>
        ) : handovers.length === 0 ? (
          <div className="border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm font-mono text-slate-500">
            No handovers found in the last {days} days
          </div>
        ) : (
          <div className="space-y-2">
            {handovers.map(ho => {
              const logs = details[String(ho.taskInstanceId)] ?? []
              const allSections = logs.flatMap(log =>
                log.records.flatMap(rec => extractSections(rec as unknown as Record<string, unknown>))
              )

              return (
                <article key={ho.taskInstanceId} className="border border-white/[0.08] bg-white/[0.03] p-4">

                  <div className="flex items-start justify-between gap-4 mb-3">
                    <span className="text-sm text-white font-medium">{ho.taskInstanceName}</span>
                    <Pill level={ho.completedDatetime ? 'ok' : 'pending'} label={ho.completedDatetime ? 'Completed' : 'Pending'} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 mb-3">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ho.siteName}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(ho.dueFromDatetime)}</span>
                    {ho.completedByUserName && (
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{ho.completedByUserName}</span>
                    )}
                    {ho.completedDatetime && (
                      <span className="text-slate-600">completed {formatDate(ho.completedDatetime)}</span>
                    )}
                  </div>

                  {allSections.length > 0 && (
                    <div className="border-t border-white/[0.06] pt-3 space-y-4">
                      {allSections.map(({ section, fields }) => (
                        <div key={section || '__top__'}>
                          {section && (
                            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-2">
                              {section}
                            </div>
                          )}
                          <div className="space-y-2">
                            {fields.map(field => (
                              <div key={field.id}>
                                <div className="text-[11px] text-slate-500 leading-snug mb-0.5">{field.name}</div>
                                <div className="text-[12px] text-slate-200 leading-snug">{formatFieldValue(field)}</div>
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
