'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { SITES } from '@/lib/portal'

interface TaskInstance {
  taskInstanceId: number
  taskInstanceName: string
  taskTemplateId: number
  dueFromDatetime: string
  dueByDatetime: string
  completedDatetime: string | null
  completedByUserName: string | null
  siteId: number
  siteName: string
  taskType: string
  status: string
  exceptionCount: number
  flaggedChecklistCount: number
}

type FilterState = 'all' | 'completed' | 'pending' | 'overdue'

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [filter, setFilter] = useState<FilterState>('all')
  const [siteFilter, setSiteFilter] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/trail/tasks?date=${date}`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setTasks(data.instances || [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [fetchData])

  const now = new Date()

  const filtered = tasks.filter(t => {
    if (siteFilter && t.siteId !== siteFilter) return false
    if (filter === 'completed') return !!t.completedDatetime
    if (filter === 'pending')   return !t.completedDatetime
    if (filter === 'overdue')   return !t.completedDatetime && new Date(t.dueByDatetime) < now
    return true
  })

  const completedCount = tasks.filter(t =>  !!t.completedDatetime).length
  const pendingCount   = tasks.filter(t => !t.completedDatetime).length
  const overdueCount   = tasks.filter(t => !t.completedDatetime && new Date(t.dueByDatetime) < now).length

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Operations console</div>
          <h1 className="text-3xl font-light text-white">Task board</h1>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/20"
          />
          <select
            value={siteFilter ?? ''}
            onChange={e => setSiteFilter(e.target.value ? Number(e.target.value) : null)}
            className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/20"
          >
            <option value="">All sites</option>
            {SITES.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
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
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total',     value: tasks.length,   colour: 'text-white' },
            { label: 'Completed', value: completedCount, colour: 'text-emerald-300' },
            { label: 'Pending',   value: pendingCount,   colour: 'text-slate-300' },
            { label: 'Overdue',   value: overdueCount,   colour: overdueCount > 0 ? 'text-red-300' : 'text-white' },
          ].map(({ label, value, colour }) => (
            <article key={label} className="border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-2">{label}</div>
              <div className={`font-mono text-3xl font-light ${colour}`}>{value}</div>
            </article>
          ))}
        </div>
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1">
        {(['all', 'completed', 'pending', 'overdue'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
              filter === f
                ? 'border-white/[0.15] bg-white/[0.05] text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Task list ──────────────────────────────────────────────────────────── */}
      {loading && tasks.length === 0 ? (
        <div className="border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm font-mono text-slate-500">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm font-mono text-slate-500">
          No tasks found
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(task => {
            const isOverdue   = !task.completedDatetime && new Date(task.dueByDatetime) < now
            const isCompleted = !!task.completedDatetime
            return (
              <article
                key={task.taskInstanceId}
                className={`border bg-white/[0.03] px-4 py-3 flex items-center gap-4 ${
                  isOverdue ? 'border-red-500/20' : 'border-white/[0.08]'
                }`}
              >
                <div className="shrink-0">
                  {isCompleted
                    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                    : isOverdue
                    ? <XCircle    className="w-4 h-4 text-red-400" />
                    : <Clock      className="w-4 h-4 text-slate-500" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{task.taskInstanceName}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-500">
                    <span>{task.siteName}</span>
                    <span className="text-slate-700">·</span>
                    <span>{formatTime(task.dueFromDatetime)} – {formatTime(task.dueByDatetime)}</span>
                    {isCompleted && (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="text-emerald-500">done {formatTime(task.completedDatetime!)}</span>
                      </>
                    )}
                  </div>
                </div>

                {task.exceptionCount > 0 && (
                  <span className="shrink-0 flex items-center gap-1 text-[10px] font-mono text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5">
                    <AlertTriangle className="w-3 h-3" />{task.exceptionCount}
                  </span>
                )}
                {task.completedByUserName && (
                  <span className="shrink-0 text-[11px] font-mono text-slate-500">{task.completedByUserName}</span>
                )}
              </article>
            )
          })}
        </div>
      )}

    </div>
  )
}
