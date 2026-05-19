'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'

interface TrailScore {
  id: number
  level: string
  name: string
  average: number
  scores: Record<string, { score: number; status: string | null }>
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

  useEffect(() => { fetchData() }, [fetchData])

  function scoreColor(score: number) {
    if (score >= 90) return 'text-emerald-400'
    if (score >= 70) return 'text-amber-400'
    return 'text-red-400'
  }

  function scoreBg(score: number) {
    if (score >= 90) return 'bg-emerald-500/10 border-emerald-500/20'
    if (score >= 70) return 'bg-amber-500/10 border-amber-500/20'
    return 'bg-red-500/10 border-red-500/20'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            Site Scores
          </h1>
          <p className="text-zinc-400 mt-1">Compliance & performance scores from Trail</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <select value={interval} onChange={e => setInterval_(e.target.value as 'day' | 'week' | 'month')}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      {loading && scores.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">Loading scores...</div>
      ) : scores.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">No score data available</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scores.map(score => (
            <div key={score.id} className={`rounded-xl border p-5 ${scoreBg(score.average)}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">{score.name}</h3>
                <span className="text-[10px] text-zinc-500 uppercase">{score.level}</span>
              </div>
              <div className={`text-4xl font-bold ${scoreColor(score.average)}`}>
                {score.average.toFixed(1)}%
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                {Object.keys(score.scores).length} data points
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
