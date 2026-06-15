'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, RefreshCw, CheckCircle, XCircle, MessageSquare, FileText,
  Download, AlertTriangle, Trash2, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBanner } from '@/components/ui/status-banner'
import type { PoRecord, PoStatus } from '@/lib/notion-po'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Supplier { id: number; name: string }

type Tab        = 'pending' | 'all' | 'approved' | 'suppliers'
type SiteFilter = 'All' | 'Bishopstown' | 'Churchfield'

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<PoStatus, { label: string; cls: string }> = {
  'Pending Review':       { label: 'Pending',   cls: 'bg-amber-500/15 text-amber-300'   },
  'Approved':             { label: 'Approved',  cls: 'bg-emerald-500/15 text-emerald-300' },
  'Rejected':             { label: 'Rejected',  cls: 'bg-red-500/15 text-red-300'       },
  'More Info Requested':  { label: 'More Info', cls: 'bg-blue-500/15 text-blue-300'     },
}

const URGENCY_BADGE: Record<string, string> = {
  Routine:   'bg-white/10 text-white/50',
  Urgent:    'bg-amber-500/15 text-amber-300',
  Emergency: 'bg-red-500/15 text-red-300',
}

function fmtCcy(v: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(v)
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Approval Modal ─────────────────────────────────────────────────────────────

function ReviewModal({
  po,
  onClose,
  onDone,
}: {
  po: PoRecord
  onClose: () => void
  onDone: () => void
}) {
  const [action, setAction]   = useState<PoStatus | null>(null)
  const [notes, setNotes]     = useState(po.adminNotes ?? '')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function submit() {
    if (!action) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/purchase-orders/${po.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action, adminNotes: notes }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error'); setSaving(false); return }
    onDone()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="surface-card w-full max-w-lg space-y-5 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-headline text-white">{po.description}</h2>
            <p className="mt-0.5 text-[13px] text-white/40">
              {po.site} · Submitted by {po.requestedBy} on {fmtDate(po.requestDate)}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-white/30 hover:text-white/60">
            <XCircle className="size-5" />
          </button>
        </div>

        {/* Details grid */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {[
            ['Supplier', po.supplier],
            ['Value', fmtCcy(po.value)],
            ['Urgency', po.urgency],
            ['Current status', STATUS_BADGE[po.status]?.label ?? po.status],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-white/30">{k}</dt>
              <dd className="mt-0.5 text-white/80">{v}</dd>
            </div>
          ))}
        </dl>

        {po.poNumber && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm">
            <span className="text-white/40">PO Number: </span>
            <span className="font-mono font-semibold text-emerald-300">{po.poNumber}</span>
          </div>
        )}

        {/* Quote download */}
        {po.quoteFilename && (
          <a
            href={`/api/purchase-orders/${po.id}/quote`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 transition-colors hover:text-white"
          >
            <FileText className="size-4 shrink-0 text-white/30" />
            <span className="min-w-0 flex-1 truncate">{po.quoteFilename}</span>
            <Download className="size-3.5 shrink-0 text-white/30" />
          </a>
        )}

        {/* Admin notes */}
        {po.adminNotes && po.status !== 'Pending Review' && (
          <div className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white/60">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-white/30">Notes</p>
            {po.adminNotes}
          </div>
        )}

        {/* Action buttons — only for pending */}
        {po.status === 'Pending Review' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['Approved',            'Approve',    CheckCircle,    'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'],
                ['Rejected',            'Reject',     XCircle,        'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'],
                ['More Info Requested', 'More Info',  MessageSquare,  'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'],
              ] as const).map(([val, lbl, Icon, cls]) => (
                <button
                  key={val} type="button"
                  onClick={() => setAction(action === val ? null : val)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                    action === val ? cls : 'border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80'
                  }`}
                >
                  <Icon className="size-4" />
                  {lbl}
                </button>
              ))}
            </div>

            {action && (
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={
                  action === 'Approved' ? 'Optional note…'
                  : action === 'Rejected' ? 'Reason for rejection…'
                  : 'What information is needed?'
                }
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            )}

            {error && <StatusBanner variant="error">{error}</StatusBanner>}

            {action && (
              <Button
                variant="primary" className="w-full" onClick={submit} disabled={saving}
              >
                {saving ? 'Saving…' : `Confirm ${action === 'Approved' ? 'Approval' : action === 'Rejected' ? 'Rejection' : 'Request'}`}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Suppliers Panel ────────────────────────────────────────────────────────────

function SuppliersPanel() {
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [loading, setLoading]       = useState(true)
  const [newName, setNewName]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/suppliers')
    if (res.ok) setSuppliers((await res.json()).suppliers ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function add() {
    const name = newName.trim()
    if (!name) return
    setSaving(true); setError(null)
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setNewName('')
    await load()
    setSaving(false)
  }

  async function remove(id: number) {
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    setSuppliers(s => s.filter(x => x.id !== id))
  }

  if (loading) return <LoadingState label="Loading suppliers…" />

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add supplier name…"
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <Button variant="primary" size="sm" onClick={add} disabled={saving || !newName.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
      {error && <StatusBanner variant="error">{error}</StatusBanner>}
      {suppliers.length === 0 ? (
        <EmptyState icon={ExternalLink} title="No suppliers yet" description="Add your first supplier above." />
      ) : (
        <ul className="space-y-1.5">
          {suppliers.map(s => (
            <li key={s.id} className="surface-card flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 text-sm text-white/80">{s.name}</span>
              <button onClick={() => remove(s.id)} className="text-white/20 hover:text-red-400 transition-colors">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const { isAdmin, user } = useAuth()
  const router = useRouter()

  const [pos, setPos]             = useState<PoRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [tab, setTab]             = useState<Tab>('pending')
  const [siteFilter, setSiteFilter] = useState<SiteFilter>('All')
  const [reviewing, setReviewing] = useState<PoRecord | null>(null)
  const [feedback, setFeedback]   = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch('/api/purchase-orders')
    if (res.ok) setPos((await res.json()).purchaseOrders ?? [])
    else setError('Failed to load purchase orders.')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const sitePos  = siteFilter === 'All' ? pos : pos.filter(p => p.site === siteFilter)
  const pending  = sitePos.filter(p => p.status === 'Pending Review')
  const approved = sitePos.filter(p => p.status === 'Approved')

  const shown = tab === 'pending'  ? pending
              : tab === 'approved' ? approved
              : sitePos

  function handleReviewDone() {
    setReviewing(null)
    setFeedback({ type: 'success', msg: 'PO updated successfully.' })
    load()
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title">Purchase Orders</h1>
          <p className="mt-1 text-[13px] text-white/40">
            {isAdmin ? 'Review and approve PO requests from all sites.' : 'Submit a purchase order request for manager approval.'}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/purchase-orders/new')}>
          <Plus className="size-4" /> New Request
        </Button>
      </div>

      {feedback && (
        <StatusBanner variant={feedback.type === 'success' ? 'success' : 'error'} onDismiss={() => setFeedback(null)}>
          {feedback.msg}
        </StatusBanner>
      )}
      {error && <StatusBanner variant="error">{error}</StatusBanner>}

      {/* Site filter */}
      <div className="inline-flex rounded-xl bg-white/[0.06] p-1">
        {(['All', 'Bishopstown', 'Churchfield'] as SiteFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setSiteFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              siteFilter === s
                ? 'bg-white/[0.12] font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total',          value: sitePos.length,                              colour: 'text-white'       },
          { label: 'Pending',        value: pending.length,                              colour: pending.length > 0 ? 'text-amber-300' : 'text-white/60' },
          { label: 'Approved',       value: approved.length,                             colour: 'text-emerald-300' },
          { label: 'Approved value', value: fmtCcy(approved.reduce((s, p) => s + p.value, 0)), colour: 'text-white/70' },
        ].map(({ label, value, colour }) => (
          <article key={label} className="surface-card p-4">
            <div className="text-caption text-white/40">{label}</div>
            <div className={`mt-1.5 text-2xl font-light ${colour}`}>{loading ? '…' : value}</div>
          </article>
        ))}
      </div>

      {/* Tabs */}
      <div role="tablist" className="inline-flex flex-wrap rounded-xl bg-white/[0.06] p-1">
        {([
          ['pending',   `Pending${pending.length ? ` (${pending.length})` : ''}`],
          ['all',       'All'],
          ['approved',  'Approved'],
          ...(isAdmin ? [['suppliers', 'Suppliers']] : []),
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t} role="tab" aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              tab === t
                ? 'bg-white/[0.12] font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Suppliers panel */}
      {tab === 'suppliers' && isAdmin && <SuppliersPanel />}

      {/* PO list */}
      {tab !== 'suppliers' && (
        loading ? (
          <LoadingState label="Loading purchase orders…" />
        ) : shown.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icon={FileText}
              title={tab === 'pending' ? 'No pending requests' : 'No purchase orders'}
              description={tab === 'pending' ? 'All requests have been reviewed.' : 'No POs submitted yet.'}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            {shown.map(po => {
              const badge = STATUS_BADGE[po.status] ?? { label: po.status, cls: 'bg-white/10 text-white/50' }
              const urgBadge = URGENCY_BADGE[po.urgency] ?? 'bg-white/10 text-white/50'
              return (
                <article
                  key={po.id}
                  className={`surface-card flex flex-wrap items-center gap-4 px-4 py-3 ${
                    po.status === 'Pending Review' ? 'ring-1 ring-inset ring-amber-500/20' : ''
                  }`}
                >
                  {/* PO number / placeholder */}
                  <span className="w-24 shrink-0 font-mono text-[11px] text-white/30">
                    {po.poNumber ?? '—'}
                  </span>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{po.description}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/40">
                      <span>{po.supplier}</span>
                      <span className="text-white/20">·</span>
                      <span>{po.site}</span>
                      <span className="text-white/20">·</span>
                      <span>{fmtDate(po.requestDate ?? po.createdTime)}</span>
                      {po.requestedBy !== user?.name && (
                        <><span className="text-white/20">·</span><span>{po.requestedBy}</span></>
                      )}
                    </div>
                  </div>

                  {/* Value */}
                  <span className="shrink-0 font-mono text-sm text-white/70">{fmtCcy(po.value)}</span>

                  {/* Urgency badge */}
                  <span className={`flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium ${urgBadge}`}>
                    {po.urgency}
                  </span>

                  {/* Status badge */}
                  <span className={`flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>

                  {/* Quote icon */}
                  {po.quoteFilename && (
                    <a
                      href={`/api/purchase-orders/${po.id}/quote`}
                      target="_blank" rel="noopener noreferrer"
                      className="shrink-0 text-white/25 hover:text-white/60 transition-colors"
                      title={po.quoteFilename}
                      onClick={e => e.stopPropagation()}
                    >
                      <FileText className="size-4" />
                    </a>
                  )}

                  {/* Exception / notes indicator */}
                  {po.adminNotes && (
                    <span title={po.adminNotes} className="shrink-0 text-white/25">
                      <MessageSquare className="size-4" />
                    </span>
                  )}

                  {/* Admin review button */}
                  {isAdmin && po.status === 'Pending Review' && (
                    <Button variant="secondary" size="xs" onClick={() => setReviewing(po)}>
                      Review
                    </Button>
                  )}
                  {/* View button for non-pending / non-admin */}
                  {(!isAdmin || po.status !== 'Pending Review') && (
                    <Button variant="ghost" size="xs" onClick={() => setReviewing(po)}>
                      View
                    </Button>
                  )}
                </article>
              )
            })}
          </div>
        )
      )}

      {/* Review modal */}
      {reviewing && (
        <ReviewModal po={reviewing} onClose={() => setReviewing(null)} onDone={handleReviewDone} />
      )}

    </div>
  )
}
