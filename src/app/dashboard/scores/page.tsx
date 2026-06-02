'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

interface TrailScore {
  id: number
  level: string
  name: string
  average: number
  scores: Record<string, { score: number; status: string | null }>
}

function scoreColour(v: number) {
  if (v >= 90) return 'text-emerald-300'
  if (v >= 70) return 'text-amber-300'
  return 'text-red-300'
}

function scorePill(v: number) {
  if (v >= 90) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (v >= 70) return 'border-amber-500/30   bg-amber-500/10   text-amber-300'
  return          'border-red-500/30    bg-red-500/10    text-red-300'
}

export default function ScoresPage() {
  const [scores, setScores] = useState<TrailScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interval, setInterval_] = useState<'day' | 'week' | 'month'>('day')
  const [days, setDays] = useState(30)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
      const res = await fetch(`/api/trail/scores?startDate=${startDate}&endDate=${endDate}&interval=${interval}`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setScores(data.scores || [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [interval, days])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [fetchData])

  const avg = scores.length ? scores.reduce((s, x) => s + x.average, 0) / scores.length : null

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Operations console</div>
          <h1 className="text-3xl font-light text-white">Site scores</h1>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/20"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <select
            value={interval}
            onChange={e => setInterval_(e.target.value as 'day' | 'week' | 'month')}
            className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/20"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
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
      {scores.length > 0 && avg !== null && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Overview</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sites tracked',  value: String(scores.length) },
              { label: 'Average score',  value: `${avg.toFixed(1)}%` },
              { label: 'Data points',    value: String(scores.reduce((s, x) => s + Object.keys(x.scores).length, 0)) },
            ].map(({ label, value }) => (
              <article key={label} className="border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-2">{label}</div>
                <div className={`font-mono text-3xl font-light ${avg !== null && label === 'Average score' ? scoreColour(avg) : 'text-white'}`}>{value}</div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ── Score cards ────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Scores</div>

        {loading && scores.length === 0 ? (
          <div className="border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm font-mono text-slate-500">
            Loading…
          </div>
        ) : scores.length === 0 ? (
          <div className="border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm font-mono text-slate-500">
            No score data available
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scores.map(score => (
              <article key={score.id} className="border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-sm text-white font-medium leading-snug">{score.name}</span>
                  <span className={`inline-block border px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase whitespace-nowrap shrink-0 ${scorePill(score.average)}`}>
                    {score.level}
                  </span>
                </div>
                <div className={`font-mono text-4xl font-light ${scoreColour(score.average)}`}>
                  {score.average.toFixed(1)}%
                </div>
                <div className="mt-2 text-[10px] font-mono text-slate-500">
                  {Object.keys(score.scores).length} data points
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
