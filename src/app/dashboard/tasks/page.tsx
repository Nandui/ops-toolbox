'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckSquare, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'overdue'>('all')
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
    if (filter === 'pending') return !t.completedDatetime
    if (filter === 'overdue') return !t.completedDatetime && new Date(t.dueByDatetime) < now
    return true
  })

  const completedCount = tasks.filter(t => !!t.completedDatetime).length
  const pendingCount = tasks.filter(t => !t.completedDatetime).length
  const overdueCount = tasks.filter(t => !t.completedDatetime && new Date(t.dueByDatetime) < now).length

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-400" />
            Task Board
          </h1>
          <p className="text-zinc-400 mt-1">Daily task completion from Trail</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          <select value={siteFilter ?? ''} onChange={e => setSiteFilter(e.target.value ? Number(e.target.value) : null)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">All Sites</option>
            {SITES.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', count: tasks.length, color: 'text-zinc-400', bg: 'bg-zinc-800' },
          { label: 'Completed', count: completedCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Pending', count: pendingCount, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Overdue', count: overdueCount, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-zinc-800 rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'completed', 'pending', 'overdue'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === f ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/50'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {error && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      {loading && tasks.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">No tasks found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const isOverdue = !task.completedDatetime && new Date(task.dueByDatetime) < now
            const isCompleted = !!task.completedDatetime
            return (
              <div key={task.taskInstanceId} className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-4 ${
                isOverdue ? 'border-red-500/30' : isCompleted ? '' : ''
              }`}>
                <div className="shrink-0">
                  {isCompleted ? <CheckCircle className="w-5 h-5 text-emerald-400" /> :
                   isOverdue ? <XCircle className="w-5 h-5 text-red-400" /> :
                   <Clock className="w-5 h-5 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{task.taskInstanceName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-500">{task.siteName}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-500">{formatTime(task.dueFromDatetime)} — {formatTime(task.dueByDatetime)}</span>
                    {task.completedDatetime && <><span className="text-zinc-700">·</span><span className="text-xs text-emerald-500">Done {formatTime(task.completedDatetime)}</span></>}
                  </div>
                </div>
                {task.exceptionCount > 0 && (
                  <span className="shrink-0 flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" />{task.exceptionCount}
                  </span>
                )}
                {task.completedByUserName && <span className="shrink-0 text-xs text-zinc-500">{task.completedByUserName}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
