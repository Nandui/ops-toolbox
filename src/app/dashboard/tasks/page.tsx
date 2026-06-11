'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, CheckSquare } from 'lucide-react'
import { SITES } from '@/lib/portal'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

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

const controlCls = 'h-9 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-white font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-title">Task Board</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="tasks-date" className="sr-only">Date</label>
          <input id="tasks-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={controlCls} />
          <label htmlFor="tasks-site" className="sr-only">Site</label>
          <select
            id="tasks-site"
            value={siteFilter ?? ''}
            onChange={e => setSiteFilter(e.target.value ? Number(e.target.value) : null)}
            className={controlCls}
          >
            <option value="">All sites</option>
            {SITES.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            aria-label="Refresh tasks"
            className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-white/50 hover:text-white disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
          {error}
        </div>
      )}

      {/* ── KPI strip ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total',     value: tasks.length,   colour: 'text-white' },
          { label: 'Completed', value: completedCount, colour: 'text-emerald-300' },
          { label: 'Pending',   value: pendingCount,   colour: 'text-white/70' },
          { label: 'Overdue',   value: overdueCount,   colour: overdueCount > 0 ? 'text-red-300' : 'text-white' },
        ].map(({ label, value, colour }) => (
          <article key={label} className="surface-card p-4">
            <div className="text-caption text-white/40">{label}</div>
            <div className={`mt-1.5 font-mono text-3xl font-light ${colour}`}>{value}</div>
          </article>
        ))}
      </div>

      {/* ── Filter segmented control ──────────────────────────────────────────── */}
      <div role="tablist" aria-label="Filter tasks" className="inline-flex rounded-xl bg-white/[0.06] p-1">
        {(['all', 'completed', 'pending', 'overdue'] as const).map(f => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-[13px] capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              filter === f
                ? 'bg-white/[0.12] font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Task list ──────────────────────────────────────────────────────────── */}
      {loading && tasks.length === 0 ? (
        <LoadingState label="Loading tasks…" />
      ) : filtered.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={CheckSquare}
            title="No tasks found"
            description={filter !== 'all' ? `No ${filter} tasks for this day.` : 'No tasks scheduled for this day.'}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(task => {
            const isOverdue   = !task.completedDatetime && new Date(task.dueByDatetime) < now
            const isCompleted = !!task.completedDatetime
            return (
              <article
                key={task.taskInstanceId}
                className={`surface-card flex items-center gap-4 px-4 py-3 ${
                  isOverdue ? 'ring-1 ring-inset ring-red-500/25' : ''
                }`}
              >
                <div className="shrink-0">
                  {isCompleted
                    ? <CheckCircle className="size-4 text-emerald-400" />
                    : isOverdue
                    ? <XCircle    className="size-4 text-red-400" />
                    : <Clock      className="size-4 text-white/35" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-white">{task.taskInstanceName}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs font-mono text-white/40">
                    <span>{task.siteName}</span>
                    <span className="text-white/20">·</span>
                    <span>{formatTime(task.dueFromDatetime)} – {formatTime(task.dueByDatetime)}</span>
                    {isCompleted && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="text-emerald-400/80">done {formatTime(task.completedDatetime!)}</span>
                      </>
                    )}
                  </div>
                </div>

                {task.exceptionCount > 0 && (
                  <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 text-[12px] font-medium text-amber-300">
                    <AlertTriangle className="size-3" />{task.exceptionCount}
                  </span>
                )}
                {task.completedByUserName && (
                  <span className="hidden shrink-0 text-xs font-mono text-white/40 sm:block">{task.completedByUserName}</span>
                )}
              </article>
            )
          })}
        </div>
      )}

    </div>
  )
}
