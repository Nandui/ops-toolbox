'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, CheckSquare, ShieldCheck, ExternalLink } from 'lucide-react'
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

type FilterState = 'all' | 'pending_approval' | 'pending' | 'overdue' | 'completed'

const FILTER_LABELS: Record<FilterState, string> = {
  all: 'All',
  pending_approval: 'Pending approval',
  pending: 'To do',
  overdue: 'Overdue',
  completed: 'Completed',
}

// Trail's sign-off flow moves a completed task into "Pending approval" status
// until a manager approves it inside the Trail app. Normalise robustly.
function normStatus(s: string) {
  return (s || '').toLowerCase().replace(/[\s-]+/g, '_')
}
function isPendingApproval(t: TaskInstance) {
  const n = normStatus(t.status)
  return n.includes('approval') && !n.includes('approved')
}
function isApproved(t: TaskInstance) {
  return normStatus(t.status).includes('approved')
}

// Deep link to the task instance in Trail's Task Reports UI.
// Opens the approval screen directly where the manager can sign off.
function trailApprovalUrl(taskInstanceId: number) {
  return `https://web.trailapp.com/reports/task_instances/${taskInstanceId}`
}

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

  const visible = tasks.filter(t => !siteFilter || t.siteId === siteFilter)

  const filtered = visible.filter(t => {
    if (filter === 'pending_approval') return isPendingApproval(t)
    if (filter === 'completed')        return !!t.completedDatetime && !isPendingApproval(t)
    if (filter === 'pending')          return !t.completedDatetime
    if (filter === 'overdue')          return !t.completedDatetime && new Date(t.dueByDatetime) < now
    return true
  })

  // Pending-approval tasks float to the top — they are the actionable items.
  const sorted = [...filtered].sort((a, b) => {
    const pa = isPendingApproval(a) ? 0 : 1
    const pb = isPendingApproval(b) ? 0 : 1
    if (pa !== pb) return pa - pb
    return new Date(a.dueByDatetime).getTime() - new Date(b.dueByDatetime).getTime()
  })

  const pendingApprovalCount = visible.filter(isPendingApproval).length
  const completedCount       = visible.filter(t => !!t.completedDatetime && !isPendingApproval(t)).length
  const overdueCount         = visible.filter(t => !t.completedDatetime && new Date(t.dueByDatetime) < now).length

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
          <Button variant="tertiary" size="icon" onClick={fetchData} disabled={loading} aria-label="Refresh tasks">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {error && <StatusBanner variant="error">{error}</StatusBanner>}

      {/* ── KPI strip ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total',            value: visible.length,       colour: 'text-white' },
          { label: 'Pending approval', value: pendingApprovalCount, colour: pendingApprovalCount > 0 ? 'text-amber-300' : 'text-white/60' },
          { label: 'Completed',        value: completedCount,       colour: 'text-emerald-300' },
          { label: 'Overdue',          value: overdueCount,         colour: overdueCount > 0 ? 'text-red-300' : 'text-white/60' },
        ].map(({ label, value, colour }) => (
          <article key={label} className="surface-card p-4">
            <div className="text-caption text-white/40">{label}</div>
            <div className={`mt-1.5 font-mono text-3xl font-light ${colour}`}>{value}</div>
          </article>
        ))}
      </div>

      {/* ── Pending-approval call-to-action ──────────────────────────────────── */}
      {pendingApprovalCount > 0 && (
        <div className="surface-card flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 ring-1 ring-inset ring-amber-500/20">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm text-white">
                {pendingApprovalCount} task{pendingApprovalCount === 1 ? '' : 's'} awaiting sign-off
              </p>
              <p className="mt-0.5 text-[13px] text-white/45">
                Approval is managed in Trail — open each task below to sign off.
              </p>
            </div>
          </div>
          <a
            href="https://web.trailapp.com/reports"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-amber-500/15 px-3 text-[13px] font-medium text-amber-300 transition-colors hover:bg-amber-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            Open Trail reports <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}

      {/* ── Filter tabs ────────────────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Filter tasks" className="inline-flex flex-wrap rounded-xl bg-white/[0.06] p-1">
        {(['all', 'pending_approval', 'pending', 'overdue', 'completed'] as const).map(f => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              filter === f
                ? 'bg-white/[0.12] font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {FILTER_LABELS[f]}
            {f === 'pending_approval' && pendingApprovalCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-300">
                {pendingApprovalCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Task list ──────────────────────────────────────────────────────────── */}
      {loading && tasks.length === 0 ? (
        <LoadingState label="Loading tasks…" />
      ) : sorted.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={filter === 'pending_approval' ? ShieldCheck : CheckSquare}
            title={filter === 'pending_approval' ? 'Nothing to approve' : 'No tasks found'}
            description={
              filter === 'pending_approval'
                ? 'No tasks are waiting for sign-off on this day.'
                : filter !== 'all'
                ? `No ${FILTER_LABELS[filter].toLowerCase()} tasks for this day.`
                : 'No tasks scheduled for this day.'
            }
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map(task => {
            const pending     = isPendingApproval(task)
            const approved    = isApproved(task)
            const isOverdue   = !task.completedDatetime && new Date(task.dueByDatetime) < now
            const isCompleted = !!task.completedDatetime
            return (
              <article
                key={task.taskInstanceId}
                className={`surface-card flex items-center gap-4 px-4 py-3 ${
                  pending ? 'ring-1 ring-inset ring-amber-500/25' : isOverdue ? 'ring-1 ring-inset ring-red-500/25' : ''
                }`}
              >
                <div className="shrink-0">
                  {pending
                    ? <ShieldCheck className="size-4 text-amber-300" />
                    : approved || isCompleted
                    ? <CheckCircle className="size-4 text-emerald-400" />
                    : isOverdue
                    ? <XCircle    className="size-4 text-red-400" />
                    : <Clock      className="size-4 text-white/35" />}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{task.taskInstanceName}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-white/40">
                    <span>{task.siteName}</span>
                    <span className="text-white/20">·</span>
                    <span>{formatTime(task.dueFromDatetime)} – {formatTime(task.dueByDatetime)}</span>
                    {isCompleted && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="text-emerald-400/80">done {formatTime(task.completedDatetime!)}</span>
                      </>
                    )}
                    {task.completedByUserName && (
                      <>
                        <span className="text-white/20">·</span>
                        <span>{task.completedByUserName}</span>
                      </>
                    )}
                  </div>
                </div>

                {task.exceptionCount > 0 && (
                  <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 text-[12px] font-medium text-amber-300">
                    <AlertTriangle className="size-3" />{task.exceptionCount}
                  </span>
                )}

                {pending && (
                  <a
                    href={trailApprovalUrl(task.taskInstanceId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-amber-500/15 px-3 text-[13px] font-medium text-amber-300 transition-colors hover:bg-amber-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    aria-label={`Approve "${task.taskInstanceName}" in Trail`}
                  >
                    Approve <ExternalLink className="size-3.5" />
                  </a>
                )}

                {approved && !pending && (
                  <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 text-[12px] font-medium text-emerald-300">
                    <CheckCircle className="size-3" /> Approved
                  </span>
                )}
              </article>
            )
          })}
        </div>
      )}

    </div>
  )
}
