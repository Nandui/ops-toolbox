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
            {handovers.map(ho => (
              <article key={ho.taskInstanceId} className="border border-white/[0.08] bg-white/[0.03] p-4">

                <div className="flex items-start justify-between gap-4 mb-3">
                  <span className="text-sm text-white font-medium">{ho.taskInstanceName}</span>
                  <Pill level={ho.completedDatetime ? 'ok' : 'pending'} label={ho.completedDatetime ? 'Completed' : 'Pending'} />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{ho.siteName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{formatDate(ho.dueFromDatetime)}
                  </span>
                  {ho.completedByUserName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />{ho.completedByUserName}
                    </span>
                  )}
                  {ho.completedDatetime && (
                    <span className="text-slate-600">
                      completed {formatDate(ho.completedDatetime)}
                    </span>
                  )}
                </div>

                {details[String(ho.taskInstanceId)] && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                    {details[String(ho.taskInstanceId)].flatMap((log, logIdx) =>
                      log.records.map((rec, ri) => (
                        <div key={`${logIdx}-${ri}`} className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[11px] font-mono">
                          {Object.entries(rec).map(([key, val]) => (
                            <div key={key}>
                              <span className="text-slate-500">{key.replace(/_/g, ' ')}: </span>
                              <span className="text-slate-300">{String(val ?? '—')}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}

              </article>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
