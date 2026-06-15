'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, MessageSquare, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { StatusBanner } from '@/components/ui/status-banner'
import type { PoRequest, PoStatus } from '@/lib/notion/purchase-orders'

// ── Constants ──────────────────────────────────────────────────────────────────

const SITES     = ['Bishopstown', 'Churchfield'] as const
const URGENCIES = ['Routine', 'Urgent', 'Emergency'] as const

type Tab        = 'submit' | 'requests'
type SiteFilter = 'All' | 'Bishopstown' | 'Churchfield'
type StatusFilter = 'All' | 'Pending Review' | 'Approved' | 'Rejected'

const STATUS_BADGE: Record<PoStatus, { label: string; cls: string }> = {
  'Pending Review': { label: 'Pending',  cls: 'bg-amber-500/15 text-amber-300'    },
  'Approved':       { label: 'Approved', cls: 'bg-emerald-500/15 text-emerald-300' },
  'Rejected':       { label: 'Rejected', cls: 'bg-red-500/15 text-red-300'        },
}
const URGENCY_CLS: Record<string, string> = {
  Routine:   'bg-white/10 text-white/50',
  Urgent:    'bg-amber-500/15 text-amber-300',
  Emergency: 'bg-red-500/15 text-red-300',
}

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-ring/40'
const labelCls = 'block text-[13px] font-medium text-white/60 mb-1.5'

function fmtCcy(v: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(v)
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Approve Modal ──────────────────────────────────────────────────────────────

function ApproveModal({
  po,
  onClose,
  onDone,
}: {
  po: PoRequest
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [action, setAction]   = useState<'approve' | 'reject' | null>(null)
  const [poCode, setPoCode]   = useState('')
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const inputRef              = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (action === 'approve') inputRef.current?.focus()
  }, [action])

  async function submit() {
    if (!action) return
    if (action === 'approve' && !poCode.trim()) {
      setError('Enter a PO code to approve.'); return
    }
    if (action === 'reject' && !notes.trim()) {
      setError('Enter a reason for rejection.'); return
    }
    setSaving(true); setError(null)
    const body: Record<string, string> = {
      status: action === 'approve' ? 'Approved' : 'Rejected',
    }
    if (action === 'approve') { body.poNumber = poCode.trim(); body.adminNotes = notes }
    else { body.adminNotes = notes }

    const res = await fetch(`/api/purchase-orders/${po.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); setSaving(false); return }
    onDone(action === 'approve' ? `Approved — PO ${poCode.trim()}` : 'Request rejected.')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="surface-card w-full max-w-lg space-y-5 rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-headline text-white">{po.description}</h2>
            <p className="mt-0.5 text-[13px] text-white/40">
              {po.site} · {po.supplier} · {po.requestedBy} · {fmtDate(po.requestDate)}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-white/30 hover:text-white/60">
            <XCircle className="size-5" />
          </button>
        </div>

        {/* Details */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {([
            ['Value',   fmtCcy(po.value)],
            ['Urgency', po.urgency],
          ] as const).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-white/30">{k}</dt>
              <dd className="mt-0.5 text-white/80">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Action selector */}
        {!action ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAction('approve')}
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              <CheckCircle className="size-4" /> Approve
            </button>
            <button
              onClick={() => setAction('reject')}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20"
            >
              <XCircle className="size-4" /> Reject
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button onClick={() => { setAction(null); setError(null) }} className="text-white/30 hover:text-white/60">
                <ArrowLeft className="size-4" />
              </button>
              <span className={`text-sm font-medium ${action === 'approve' ? 'text-emerald-300' : 'text-red-300'}`}>
                {action === 'approve' ? 'Approving request' : 'Rejecting request'}
              </span>
            </div>

            {action === 'approve' && (
              <div>
                <label className={labelCls}>PO Code <span className="text-red-400">*</span></label>
                <input
                  ref={inputRef}
                  type="text"
                  value={poCode}
                  onChange={e => setPoCode(e.target.value)}
                  placeholder="e.g. LWBT06260001"
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>
                {action === 'approve' ? 'Notes (optional)' : 'Reason for rejection'}{' '}
                {action === 'reject' && <span className="text-red-400">*</span>}
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={action === 'approve' ? 'Any additional notes…' : 'Explain why this is being rejected…'}
                className={`${inputCls} resize-none`}
              />
            </div>

            {error && <StatusBanner variant="error">{error}</StatusBanner>}

            <Button
              variant={action === 'approve' ? 'primary' : 'destructive'}
              className="w-full"
              onClick={submit}
              disabled={saving}
            >
              {saving
                ? 'Saving…'
                : action === 'approve'
                  ? `Confirm Approval`
                  : 'Confirm Rejection'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Submit Form ────────────────────────────────────────────────────────────────

function SubmitForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useAuth()
  const [site, setSite]         = useState<string>('')
  const [supplier, setSupplier] = useState('')
  const [description, setDesc]  = useState('')
  const [urgency, setUrgency]   = useState('Routine')
  const [value, setValue]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!site || !supplier.trim() || !description.trim() || !urgency || !value) {
      setError('Please fill in all required fields.'); return
    }
    const v = parseFloat(value)
    if (isNaN(v) || v <= 0) { setError('Enter a valid order value.'); return }

    setSubmitting(true); setError(null)
    const form = new FormData()
    form.append('description', description.trim())
    form.append('site', site)
    form.append('supplier', supplier.trim())
    form.append('urgency', urgency)
    form.append('value', String(v))

    const res = await fetch('/api/purchase-orders', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); setSubmitting(false); return }

    setSuccess('Request submitted successfully.')
    setSite(''); setSupplier(''); setDesc(''); setUrgency('Routine'); setValue('')
    setSubmitting(false)
    onSubmitted()
  }

  return (
    <div className="mx-auto max-w-xl">
      {error   && <StatusBanner variant="error"   onDismiss={() => setError(null)}   className="mb-5">{error}</StatusBanner>}
      {success && <StatusBanner variant="success" onDismiss={() => setSuccess(null)} className="mb-5">{success}</StatusBanner>}

      <form onSubmit={handleSubmit} className="surface-card space-y-5 p-6">
        <p className="text-[13px] text-white/40">Submitting as {user?.name}</p>

        {/* Site */}
        <div>
          <label className={labelCls}>Site <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {SITES.map(s => (
              <button
                key={s} type="button" onClick={() => setSite(s)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                  site === s
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white/90'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Supplier */}
        <div>
          <label htmlFor="supplier" className={labelCls}>Supplier <span className="text-red-400">*</span></label>
          <input
            id="supplier" type="text" value={supplier}
            onChange={e => setSupplier(e.target.value)}
            placeholder="Supplier name"
            className={inputCls}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className={labelCls}>Description / Purpose <span className="text-red-400">*</span></label>
          <textarea
            id="description" rows={3} value={description}
            onChange={e => setDesc(e.target.value)}
            placeholder="What is this order for?"
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Value + Urgency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="value" className={labelCls}>Order Value (€) <span className="text-red-400">*</span></label>
            <input
              id="value" type="number" min="0.01" step="0.01"
              value={value} onChange={e => setValue(e.target.value)}
              placeholder="0.00" className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="urgency" className={labelCls}>Urgency <span className="text-red-400">*</span></label>
            <select id="urgency" value={urgency} onChange={e => setUrgency(e.target.value)} className={inputCls}>
              {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Request'}
        </Button>
      </form>
    </div>
  )
}

// ── Requests List ──────────────────────────────────────────────────────────────

function RequestsList({ pos, loading, isAdmin, onReview }: {
  pos: PoRequest[]
  loading: boolean
  isAdmin: boolean
  onReview: (po: PoRequest) => void
}) {
  const { user } = useAuth()
  const [siteFilter, setSiteFilter]     = useState<SiteFilter>('All')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')

  const filtered = pos
    .filter(p => siteFilter === 'All' || p.site === siteFilter)
    .filter(p => statusFilter === 'All' || p.status === statusFilter)

  const pending  = pos.filter(p => p.status === 'Pending Review')
  const approved = pos.filter(p => p.status === 'Approved')

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',    value: pos.length,       cls: 'text-white'        },
          { label: 'Pending',  value: pending.length,   cls: pending.length > 0 ? 'text-amber-300' : 'text-white/60' },
          { label: 'Approved', value: approved.length,  cls: 'text-emerald-300'  },
        ].map(({ label, value, cls }) => (
          <article key={label} className="surface-card p-4">
            <div className="text-caption text-white/40">{label}</div>
            <div className={`mt-1 text-2xl font-light ${cls}`}>{loading ? '…' : value}</div>
          </article>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="inline-flex rounded-xl bg-white/[0.06] p-1">
          {(['All', 'Bishopstown', 'Churchfield'] as SiteFilter[]).map(s => (
            <button
              key={s} onClick={() => setSiteFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                siteFilter === s ? 'bg-white/[0.12] font-medium text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl bg-white/[0.06] p-1">
          {(['All', 'Pending Review', 'Approved', 'Rejected'] as StatusFilter[]).map(s => (
            <button
              key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                statusFilter === s ? 'bg-white/[0.12] font-medium text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {s === 'Pending Review' ? 'Pending' : s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-sm text-white/30">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="surface-card py-10 text-center text-sm text-white/30">No requests found.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(po => {
            const badge    = STATUS_BADGE[po.status] ?? { label: po.status, cls: 'bg-white/10 text-white/50' }
            const urgBadge = URGENCY_CLS[po.urgency] ?? 'bg-white/10 text-white/50'
            const canReview = isAdmin && po.status === 'Pending Review'
            return (
              <article
                key={po.id}
                className={`surface-card flex flex-wrap items-center gap-4 px-4 py-3 ${
                  po.status === 'Pending Review' ? 'ring-1 ring-inset ring-amber-500/20' : ''
                }`}
              >
                {/* PO number if approved */}
                <span className="w-28 shrink-0 font-mono text-[11px] text-white/30">
                  {po.poNumber ?? '—'}
                </span>

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
                  {po.adminNotes && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-white/35">
                      <MessageSquare className="size-3" />{po.adminNotes}
                    </p>
                  )}
                </div>

                <span className="shrink-0 font-mono text-sm text-white/70">{fmtCcy(po.value)}</span>
                <span className={`flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium ${urgBadge}`}>
                  {po.urgency}
                </span>
                <span className={`flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium ${badge.cls}`}>
                  {badge.label}
                </span>

                {canReview && (
                  <Button variant="secondary" size="xs" onClick={() => onReview(po)}>
                    Review
                  </Button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab]           = useState<Tab>('submit')
  const [pos, setPos]           = useState<PoRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [reviewing, setReviewing] = useState<PoRequest | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/purchase-orders')
    if (res.ok) setPos((await res.json()).purchaseOrders ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const pending = pos.filter(p => p.status === 'Pending Review')

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-title">Purchase Orders</h1>
        <p className="mt-1 text-[13px] text-white/40">
          Submit and track purchase order requests.
        </p>
      </div>

      {feedback && (
        <StatusBanner variant="success" onDismiss={() => setFeedback(null)}>{feedback}</StatusBanner>
      )}

      {/* Tabs */}
      <div role="tablist" className="inline-flex rounded-xl bg-white/[0.06] p-1">
        {([
          ['submit',   'Submit Request'],
          ['requests', `Requests${pending.length > 0 && isAdmin ? ` (${pending.length} pending)` : ''}`],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t} role="tab" aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              tab === t
                ? 'bg-white/[0.12] font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'submit' && (
        <SubmitForm onSubmitted={() => { load(); setTab('requests') }} />
      )}

      {tab === 'requests' && (
        <RequestsList
          pos={pos}
          loading={loading}
          isAdmin={isAdmin}
          onReview={setReviewing}
        />
      )}

      {reviewing && (
        <ApproveModal
          po={reviewing}
          onClose={() => setReviewing(null)}
          onDone={msg => {
            setReviewing(null)
            setFeedback(msg)
            load()
          }}
        />
      )}
    </div>
  )
}
