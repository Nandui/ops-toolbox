'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, Clock, AlertTriangle, CheckSquare, ExternalLink, XCircle, Minus, ShieldCheck } from 'lucide-react'
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

type FilterState = 'all' | 'pending_approval' | 'done' | 'inprogress' | 'overdue' | 'missed'

const FILTER_LABELS: Record<FilterState, string> = {
  all:              'All',
  pending_approval: 'Pending approval',
  done:             'Done',
  inprogress:       'In progress',
  overdue:          'Overdue',
  missed:           'Missed',
}

const controlCls = 'h-9 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-white font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

function StatusIcon({ task }: { task: TaskInstance }) {
  const s = task.status.toLowerCase()
  if (DONE_STATUSES.has(s))       return <CheckCircle className="size-4 text-emerald-400" />
  if (s === 'overdue')            return <XCircle     className="size-4 text-red-400" />
  if (s === 'missed')             return <Minus       className="size-4 text-white/30" />
  if (s === 'inprogress')         return <Clock       className="size-4 text-blue-400" />
  return                                 <Clock       className="size-4 text-white/35" />
}

function StatusBadge({ task }: { task: TaskInstance }) {
  const s = task.status.toLowerCase()
  if (s === 'completedlate')  return <span className="flex h-6 shrink-0 items-center rounded-full bg-amber-500/15 px-2.5 text-[12px] font-medium text-amber-300">Late</span>
  if (s === 'completedearly') return <span className="flex h-6 shrink-0 items-center rounded-full bg-blue-500/15 px-2.5 text-[12px] font-medium text-blue-300">Early</span>
  return null
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskInstance[]>([])
  const [pendingApproval, setPendingApproval] = useState<TaskInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingApprovals, setLoadingApprovals] = useState(true)
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

  const fetchPendingApprovals = useCallback(async () => {
    setLoadingApprovals(true)
    try {
      const res = await fetch('/api/trail/tasks/pending-approval')
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setPendingApproval(data.instances || [])
    } catch {
      setPendingApproval([])
    } finally {
      setLoadingApprovals(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPendingApprovals()
  }, [fetchPendingApprovals])

  const visible = tasks.filter(t => !siteFilter || t.siteId === siteFilter)
  const visibleApprovals = pendingApproval.filter(t => !siteFilter || t.siteId === siteFilter)

  const filtered = filter === 'pending_approval'
    ? visibleApprovals
    : visible.filter(t => {
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
            onClick={() => { fetchTasks(); fetchPendingApprovals() }}
            disabled={loading || loadingApprovals}
            aria-label="Refresh tasks"
          >
            <RefreshCw className={loading || loadingApprovals ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {error && <StatusBanner variant="error">{error}</StatusBanner>}

      {/* ── Pending approval banner ───────────────────────────────────────────── */}
      {(loadingApprovals || visibleApprovals.length > 0) && (
        <div className={`surface-card flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 ${visibleApprovals.length > 0 ? 'ring-1 ring-inset ring-amber-500/20' : ''}`}>
          <div className="flex items-start gap-3">
            <ShieldCheck className={`mt-0.5 size-5 shrink-0 ${loadingApprovals ? 'text-white/30' : 'text-amber-300'}`} />
            <div>
              {loadingApprovals
                ? <p className="text-sm text-white/40">Checking for pending approvals…</p>
                : <>
                    <p className="text-sm text-white">{visibleApprovals.length} task{visibleApprovals.length === 1 ? '' : 's'} awaiting sign-off</p>
                    <p className="mt-0.5 text-[13px] text-white/45">Approval is managed in Trail — open each task to sign off.</p>
                  </>
              }
            </div>
          </div>
          {!loadingApprovals && visibleApprovals.length > 0 && (
            <a
              href="https://web.trailapp.com/reports#/tasks?approval=pending_approval"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-amber-500/15 px-3 text-[13px] font-medium text-amber-300 transition-colors hover:bg-amber-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              View all in Trail <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      )}

      {/* ── KPI strip ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total',            value: visible.length,        colour: 'text-white' },
          { label: 'Pending approval', value: visibleApprovals.length, colour: visibleApprovals.length > 0 ? 'text-amber-300' : 'text-white/60' },
          { label: 'Overdue',          value: overdueCount,          colour: overdueCount > 0 ? 'text-red-300' : 'text-white/60' },
          { label: 'Exceptions',       value: withExceptions,        colour: withExceptions > 0 ? 'text-amber-300' : 'text-white/60' },
        ].map(({ label, value, colour }) => (
          <article key={label} className="surface-card p-4">
            <div className="text-caption text-white/40">{label}</div>
            <div className={`mt-1.5 font-mono text-3xl font-light ${colour}`}>
              {label === 'Pending approval' && loadingApprovals ? '…' : value}
            </div>
          </article>
        ))}
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Filter tasks" className="inline-flex flex-wrap rounded-xl bg-white/[0.06] p-1">
        {(['all', 'pending_approval', 'done', 'inprogress', 'overdue', 'missed'] as const).map(f => {
          const count = f === 'pending_approval' ? visibleApprovals.length
            : f === 'overdue' ? overdueCount
            : f === 'missed' ? missedCount
            : null
          const badgeCls = f === 'pending_approval' ? 'bg-amber-500/20 text-amber-300'
            : f === 'overdue' ? 'bg-red-500/20 text-red-300'
            : 'bg-white/10 text-white/50'
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
              {count != null && !loadingApprovals && count > 0 && (
                <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${badgeCls}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Task list ──────────────────────────────────────────────────────────── */}
      {filter === 'pending_approval' && loadingApprovals ? (
        <LoadingState label="Checking for tasks awaiting approval…" />
      ) : loading && tasks.length === 0 && filter !== 'pending_approval' ? (
        <LoadingState label="Loading tasks…" />
      ) : sorted.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={filter === 'pending_approval' ? ShieldCheck : CheckSquare}
            title={filter === 'pending_approval' ? 'Nothing to approve' : 'No tasks found'}
            description={
              filter === 'pending_approval' ? 'No tasks are waiting for sign-off in the last 14 days.'
              : filter !== 'all' ? `No ${FILTER_LABELS[filter].toLowerCase()} tasks for this day.`
              : 'No tasks scheduled for this day.'
            }
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map(task => {
            const isPending = filter === 'pending_approval'
            return (
              <article
                key={task.taskInstanceId}
                className={`surface-card flex items-center gap-4 px-4 py-3 ${
                  isPending ? 'ring-1 ring-inset ring-amber-500/25'
                  : isOverdue(task) ? 'ring-1 ring-inset ring-red-500/25'
                  : ''
                }`}
              >
                {isPending ? <ShieldCheck className="size-4 shrink-0 text-amber-300" /> : <StatusIcon task={task} />}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{task.taskInstanceName}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-white/40">
                    <span>{task.siteName}</span>
                    <span className="text-white/20">·</span>
                    <span>
                      {isPending
                        ? new Date(task.dueByDatetime).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
                        : `${formatTime(task.dueFromDatetime)} – ${formatTime(task.dueByDatetime)}`}
                    </span>
                    {task.completedDatetime && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="text-emerald-400/80">completed {formatTime(task.completedDatetime)}</span>
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

                {!isPending && <StatusBadge task={task} />}

                {task.exceptionCount > 0 && (
                  <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 text-[12px] font-medium text-amber-300">
                    <AlertTriangle className="size-3" />{task.exceptionCount}
                  </span>
                )}

                {isPending && (
                  <a
                    href={`https://web.trailapp.com/taskontrail?task=${task.taskInstanceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-amber-500/15 px-3 text-[13px] font-medium text-amber-300 transition-colors hover:bg-amber-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    aria-label={`Approve "${task.taskInstanceName}" in Trail`}
                  >
                    Approve <ExternalLink className="size-3.5" />
                  </a>
                )}
              </article>
            )
          })}
        </div>
      )}

    </div>
  )
}
