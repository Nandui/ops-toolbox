'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, CheckSquare, ShieldCheck, Lock } from 'lucide-react'
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
  requiresPin?: boolean
  exceptionCount: number
  flaggedChecklistCount: number
}

type FilterState = 'all' | 'pending_approval' | 'completed' | 'pending' | 'overdue'

const FILTER_LABELS: Record<FilterState, string> = {
  all: 'All',
  pending_approval: 'Pending approval',
  pending: 'To do',
  overdue: 'Overdue',
  completed: 'Completed',
}

const controlCls = 'h-9 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-white font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

// Trail returns the sign-off state on each instance's `status`. Normalise it so
// we're resilient to casing/format ("Pending approval", "pending_approval", …).
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [filter, setFilter] = useState<FilterState>('all')
  const [siteFilter, setSiteFilter] = useState<number | null>(null)

  // Approval state
  const [approvingIds, setApprovingIds] = useState<Set<number>>(new Set())
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setFeedback(null)
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
    if (filter === 'completed') return !!t.completedDatetime && !isPendingApproval(t)
    if (filter === 'pending')   return !t.completedDatetime
    if (filter === 'overdue')   return !t.completedDatetime && new Date(t.dueByDatetime) < now
    return true
  })

  // Pending-approval tasks float to the top of any view — they're the actionable ones.
  const sorted = [...filtered].sort((a, b) => {
    const ap = isPendingApproval(a) ? 0 : 1
    const bp = isPendingApproval(b) ? 0 : 1
    if (ap !== bp) return ap - bp
    return new Date(a.dueByDatetime).getTime() - new Date(b.dueByDatetime).getTime()
  })

  const pendingApproval = visible.filter(isPendingApproval)
  const completedCount  = visible.filter(t => !!t.completedDatetime && !isPendingApproval(t)).length
  const overdueCount    = visible.filter(t => !t.completedDatetime && new Date(t.dueByDatetime) < now).length

  // Tasks that require a PIN must be signed off in the Trail app, not here.
  const approvableInView = sorted.filter(t => isPendingApproval(t) && !t.requiresPin)

  const approve = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return
    setFeedback(null)
    setApprovingIds(prev => new Set([...prev, ...ids]))
    try {
      const res = await fetch('/api/trail/tasks/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskInstanceIds: ids, date }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Approval failed (${res.status})`)
      setFeedback({ type: 'success', msg: `Approved ${ids.length} task${ids.length === 1 ? '' : 's'}.` })
      await fetchData()
    } catch (err) {
      setFeedback({ type: 'error', msg: `Could not approve in Trail — ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setApprovingIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    }
  }, [date, fetchData])

  const approveAll = () => {
    const ids = approvableInView.map(t => t.taskInstanceId)
    if (ids.length === 0) return
    if (!window.confirm(`Approve and sign off ${ids.length} task${ids.length === 1 ? '' : 's'}? This records you as the approver in Trail.`)) return
    approve(ids)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  }

  const bulkApproving = approvableInView.length > 0 && approvableInView.every(t => approvingIds.has(t.taskInstanceId))

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
          <Button variant="tertiary" size="icon" onClick={fetchData} disabled={loading} aria-label="Refresh tasks">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {error && <StatusBanner variant="error">{error}</StatusBanner>}
      {feedback && (
        <StatusBanner variant={feedback.type === 'success' ? 'success' : 'error'} onDismiss={() => setFeedback(null)}>
          {feedback.msg}
        </StatusBanner>
      )}

      {/* ── KPI strip ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total',            value: visible.length,        colour: 'text-white' },
          { label: 'Pending approval', value: pendingApproval.length, colour: pendingApproval.length > 0 ? 'text-amber-300' : 'text-white' },
          { label: 'Completed',        value: completedCount,        colour: 'text-emerald-300' },
          { label: 'Overdue',          value: overdueCount,          colour: overdueCount > 0 ? 'text-red-300' : 'text-white' },
        ].map(({ label, value, colour }) => (
          <article key={label} className="surface-card p-4">
            <div className="text-caption text-white/40">{label}</div>
            <div className={`mt-1.5 font-mono text-3xl font-light ${colour}`}>{value}</div>
          </article>
        ))}
      </div>

      {/* ── Approval call-to-action ───────────────────────────────────────────── */}
      {pendingApproval.length > 0 && (
        <div className="surface-card flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 ring-1 ring-inset ring-amber-500/20">
          <div className="flex min-w-0 items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="text-sm text-white">
                {pendingApproval.length} task{pendingApproval.length === 1 ? '' : 's'} awaiting approval
              </p>
              <p className="mt-0.5 text-[13px] text-white/45">
                {approvableInView.length === pendingApproval.length
                  ? 'Review the details, then sign off below.'
                  : `${pendingApproval.length - approvableInView.length} require a PIN and must be signed off in the Trail app.`}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={approveAll}
            disabled={approvableInView.length === 0 || bulkApproving}
          >
            <ShieldCheck />
            {bulkApproving ? 'Approving…' : `Approve all (${approvableInView.length})`}
          </Button>
        </div>
      )}

      {/* ── Filter segmented control ──────────────────────────────────────────── */}
      <div role="tablist" aria-label="Filter tasks" className="inline-flex flex-wrap rounded-xl bg-white/[0.06] p-1">
        {(['all', 'pending_approval', 'pending', 'overdue', 'completed'] as const).map(f => {
          const count = f === 'pending_approval' ? pendingApproval.length : null
          return (
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
              {count != null && count > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-300">
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
            icon={filter === 'pending_approval' ? ShieldCheck : CheckSquare}
            title={filter === 'pending_approval' ? 'Nothing to approve' : 'No tasks found'}
            description={
              filter === 'pending_approval'
                ? 'No tasks are waiting for sign-off on this day.'
                : filter !== 'all' ? `No ${FILTER_LABELS[filter].toLowerCase()} tasks for this day.` : 'No tasks scheduled for this day.'
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
            const busy        = approvingIds.has(task.taskInstanceId)
            return (
              <article
                key={task.taskInstanceId}
                className={`surface-card flex items-center gap-4 px-4 py-3 ${
                  pending ? 'ring-1 ring-inset ring-amber-500/25' : isOverdue ? 'ring-1 ring-inset ring-red-500/25' : ''
                }`}
              >
                <div className="shrink-0">
                  {pending
                    ? <Clock className="size-4 text-amber-300" />
                    : approved || isCompleted
                    ? <CheckCircle className="size-4 text-emerald-400" />
                    : isOverdue
                    ? <XCircle className="size-4 text-red-400" />
                    : <Clock className="size-4 text-white/35" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-white">{task.taskInstanceName}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-mono text-white/40">
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

                {/* Approval affordances — the reason this tab exists */}
                {pending ? (
                  task.requiresPin ? (
                    <span
                      className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-2.5 text-[12px] font-medium text-white/45"
                      title="Sign-off requires a PIN — approve in the Trail app"
                    >
                      <Lock className="size-3" /> PIN
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={() => approve([task.taskInstanceId])}
                      disabled={busy}
                    >
                      <ShieldCheck />
                      {busy ? 'Approving…' : 'Approve'}
                    </Button>
                  )
                ) : approved ? (
                  <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 text-[12px] font-medium text-emerald-300">
                    <CheckCircle className="size-3" /> Approved
                  </span>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

    </div>
  )
}
