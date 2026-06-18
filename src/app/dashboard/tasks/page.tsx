'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, Clock, AlertTriangle, CheckSquare, XCircle, Minus } from 'lucide-react'
import { SITES } from '@/lib/portal'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBanner } from '@/components/ui/status-banner'

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

// Trail's confirmed status values (from API inspection):
// completed, completedLate, completedEarly, inProgress, overdue, missed
// "Pending Approval" is a Trail web-UI-only filter — not exposed by the API.
const DONE_STATUSES = new Set(['completed', 'completedlate', 'completedearly'])
function isDone(t: TaskInstance)    { return DONE_STATUSES.has(t.status.toLowerCase()) }
function isMissed(t: TaskInstance)  { return t.status.toLowerCase() === 'missed' }
function isOverdue(t: TaskInstance) { return t.status.toLowerCase() === 'overdue' }

type FilterState = 'all' | 'done' | 'inprogress' | 'overdue' | 'missed'

const FILTER_LABELS: Record<FilterState, string> = {
  all:       'All',
  done:      'Done',
  inprogress:'In progress',
  overdue:   'Overdue',
  missed:    'Missed',
}

const controlCls = 'h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

function StatusIcon({ task }: { task: TaskInstance }) {
  const s = task.status.toLowerCase()
  if (DONE_STATUSES.has(s))       return <CheckCircle className="size-4 text-success" />
  if (s === 'overdue')            return <XCircle     className="size-4 text-destructive" />
  if (s === 'missed')             return <Minus       className="size-4 text-muted-foreground/70" />
  if (s === 'inprogress')         return <Clock       className="size-4 text-primary" />
  return                                 <Clock       className="size-4 text-muted-foreground/70" />
}

function StatusBadge({ task }: { task: TaskInstance }) {
  const s = task.status.toLowerCase()
  if (s === 'completedlate')  return <span className="pill-base pill-warning">Late</span>
  if (s === 'completedearly') return <span className="pill-base pill-info">Early</span>
  return null
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [filter, setFilter] = useState<FilterState>('all')
  const [siteFilter, setSiteFilter] = useState<number | null>(null)

  const fetchTasks = useCallback(async () => {
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
    fetchTasks()
  }, [fetchTasks])

  const visible = tasks.filter(t => !siteFilter || t.siteId === siteFilter)

  const filtered = visible.filter(t => {
    if (filter === 'done')       return isDone(t)
    if (filter === 'inprogress') return t.status.toLowerCase() === 'inprogress'
    if (filter === 'overdue')    return isOverdue(t)
    if (filter === 'missed')     return isMissed(t)
    return true
  })

  const sorted = [...filtered].sort((a, b) =>
    new Date(a.dueByDatetime).getTime() - new Date(b.dueByDatetime).getTime()
  )

  const overdueCount   = visible.filter(isOverdue).length
  const missedCount    = visible.filter(isMissed).length
  const withExceptions = visible.filter(t => t.exceptionCount > 0).length

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-title">Task Board</h1>
        <div className="flex flex-wrap items-center gap-2">
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
            {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button
            variant="tertiary" size="icon"
            onClick={fetchTasks}
            disabled={loading}
            aria-label="Refresh tasks"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {error && <StatusBanner variant="error">{error}</StatusBanner>}

      {/* ── KPI strip ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'Total',      value: visible.length,  colour: 'text-foreground' },
          { label: 'Overdue',    value: overdueCount,    colour: overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground' },
          { label: 'Exceptions', value: withExceptions,  colour: withExceptions > 0 ? 'text-warning' : 'text-muted-foreground' },
        ].map(({ label, value, colour }) => (
          <article key={label} className="surface-card p-4">
            <div className="text-caption text-muted-foreground">{label}</div>
            <div className={`mt-1.5 font-mono text-3xl font-light ${colour}`}>{value}</div>
          </article>
        ))}
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Filter tasks" className="inline-flex flex-wrap rounded-xl bg-muted/60 p-1">
        {(['all', 'done', 'inprogress', 'overdue', 'missed'] as const).map(f => {
          const count = f === 'overdue' ? overdueCount
            : f === 'missed' ? missedCount
            : null
          const badgeCls = f === 'overdue' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
          return (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                filter === f
                  ? 'bg-muted font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {FILTER_LABELS[f]}
              {count != null && count > 0 && (
                <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${badgeCls}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Task list ──────────────────────────────────────────────────────────── */}
      {loading && tasks.length === 0 ? (
        <LoadingState label="Loading tasks…" />
      ) : sorted.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={CheckSquare}
            title="No tasks found"
            description={
              filter !== 'all' ? `No ${FILTER_LABELS[filter].toLowerCase()} tasks for this day.`
              : 'No tasks scheduled for this day.'
            }
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map(task => (
            <article
              key={task.taskInstanceId}
              className={`surface-card flex items-center gap-4 px-4 py-3 ${
                isOverdue(task) ? 'ring-1 ring-inset ring-destructive/25' : ''
              }`}
            >
              <StatusIcon task={task} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{task.taskInstanceName}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span>{task.siteName}</span>
                  <span className="text-muted-foreground/70">·</span>
                  <span>{formatTime(task.dueFromDatetime)} – {formatTime(task.dueByDatetime)}</span>
                  {task.completedDatetime && (
                    <>
                      <span className="text-muted-foreground/70">·</span>
                      <span className="text-success">completed {formatTime(task.completedDatetime)}</span>
                    </>
                  )}
                  {task.completedByUserName && (
                    <>
                      <span className="text-muted-foreground/70">·</span>
                      <span>{task.completedByUserName}</span>
                    </>
                  )}
                </div>
              </div>

              <StatusBadge task={task} />

              {task.exceptionCount > 0 && (
                <span className="pill-base pill-warning">
                  <AlertTriangle className="size-3" />{task.exceptionCount}
                </span>
              )}
            </article>
          ))}
        </div>
      )}

    </div>
  )
}
