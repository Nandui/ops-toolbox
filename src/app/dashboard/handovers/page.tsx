'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, RefreshCw, MapPin, User, Calendar } from 'lucide-react'
import type { TrailTaskInstance, TrailRecordLog } from '@/lib/trail/client'

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-purple-400" />
            Duty Manager Handovers
          </h1>
          <p className="text-zinc-400 mt-1">Handover notes from Trail</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      {loading && handovers.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">Loading handovers...</div>
      ) : handovers.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">No handovers found in the last {days} days</div>
      ) : (
        <div className="space-y-4">
          {handovers.map(ho => (
            <div key={ho.taskInstanceId} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white font-semibold">{ho.taskInstanceName}</h3>
                {ho.completedDatetime ? (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">Completed</span>
                ) : (
                  <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 shrink-0">Pending</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ho.siteName}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(ho.dueFromDatetime)}</span>
                {ho.completedByUserName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{ho.completedByUserName}</span>}
              </div>

              {details[String(ho.taskInstanceId)] && (
                <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                  {details[String(ho.taskInstanceId)].flatMap((log, logIdx) =>
                    log.records.map((rec, ri) => (
                      <div key={`${logIdx}-${ri}`} className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {Object.entries(rec).map(([key, val]) => (
                          <div key={key}>
                            <span className="text-zinc-500">{key.replace(/_/g, ' ')}:</span>{' '}
                            <span className="text-zinc-300">{String(val ?? '—')}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
