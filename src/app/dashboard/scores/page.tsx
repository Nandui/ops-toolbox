'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, BarChart3 } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

interface TrailScore {
  id: number
  level: string
  name: string
  average: number
  scores: Record<string, { score: number; status: string | null }>
}

function scoreColour(v: number) {
  if (v >= 90) return 'text-success'
  if (v >= 70) return 'text-warning'
  return 'text-destructive'
}

function scorePill(v: number) {
  if (v >= 90) return 'pill-base pill-ok'
  if (v >= 70) return 'pill-base pill-warning'
  return 'pill-base pill-critical'
}

const controlCls = 'h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-title">Site Scores</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="scores-range" className="sr-only">Date range</label>
          <select id="scores-range" value={days} onChange={e => setDays(Number(e.target.value))} className={controlCls}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <label htmlFor="scores-interval" className="sr-only">Interval</label>
          <select
            id="scores-interval"
            value={interval}
            onChange={e => setInterval_(e.target.value as 'day' | 'week' | 'month')}
            className={controlCls}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            aria-label="Refresh scores"
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
      {scores.length > 0 && avg !== null && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Sites tracked',  value: String(scores.length) },
            { label: 'Average score',  value: `${avg.toFixed(1)}%` },
            { label: 'Data points',    value: String(scores.reduce((s, x) => s + Object.keys(x.scores).length, 0)) },
          ].map(({ label, value }) => (
            <article key={label} className="surface-card p-4">
              <div className="text-caption text-muted-foreground">{label}</div>
              <div className={`mt-1.5 font-mono text-3xl font-light ${avg !== null && label === 'Average score' ? scoreColour(avg) : 'text-foreground'}`}>{value}</div>
            </article>
          ))}
        </div>
      )}

      {/* ── Score cards ────────────────────────────────────────────────────────── */}
      {loading && scores.length === 0 ? (
        <LoadingState label="Loading scores…" />
      ) : scores.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={BarChart3}
            title="No score data"
            description="No score data is available for the selected period."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scores.map(score => (
            <article key={score.id} className="surface-card p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-snug text-foreground">{score.name}</span>
                <span className={`shrink-0 ${scorePill(score.average)}`}>
                  {score.level}
                </span>
              </div>
              <div className={`font-mono text-4xl font-light ${scoreColour(score.average)}`}>
                {score.average.toFixed(1)}%
              </div>
              <div className="mt-2 text-caption text-muted-foreground/70">
                {Object.keys(score.scores).length} data points
              </div>
            </article>
          ))}
        </div>
      )}

    </div>
  )
}
