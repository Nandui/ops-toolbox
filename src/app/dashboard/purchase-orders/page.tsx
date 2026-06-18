'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, ArrowLeft, Clock, Paperclip, FileText, Upload } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { StatusBanner } from '@/components/ui/status-banner'
import { fetchWithTimeout, loadErrorMessage } from '@/lib/fetch'
import type { PoRequest, PoStatus } from '@/lib/notion/purchase-orders'

// ── Constants ──────────────────────────────────────────────────────────────────

const SITES     = ['Bishopstown', 'Churchfield'] as const
const URGENCIES = ['Routine', 'Urgent', 'Emergency'] as const

type Tab        = 'submit' | 'requests'
type SiteFilter = 'All' | 'Bishopstown' | 'Churchfield'

const STATUS_BADGE: Record<PoStatus, { label: string; cls: string }> = {
  'Pending Review': { label: 'Pending',  cls: 'pill-base pill-warning'  },
  'Approved':       { label: 'Approved', cls: 'pill-base pill-ok'       },
  'Rejected':       { label: 'Rejected', cls: 'pill-base pill-critical' },
}
const URGENCY_CLS: Record<string, string> = {
  Routine:   'bg-muted text-muted-foreground',
  Urgent:    'pill-base pill-warning',
  Emergency: 'pill-base pill-critical',
}

const inputCls = 'w-full rounded-xl border border-border bg-muted/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/40'
const labelCls = 'block text-[13px] font-medium text-muted-foreground mb-1.5'

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

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div
        className="flex min-h-full items-end justify-center p-4 sm:items-center"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div className="surface-elevated animate-scale-in w-full max-w-lg space-y-5 rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-headline text-foreground">{po.description}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {po.site} · {po.supplier} · {po.requestedBy} · {fmtDate(po.requestDate)}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-muted-foreground/70 hover:text-muted-foreground">
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
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{k}</dt>
              <dd className="mt-0.5 text-foreground">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Quote */}
        {po.quoteUrl && (
          <a
            href={po.quoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/60 px-3.5 py-3 transition-colors hover:border-border hover:bg-muted"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{po.quoteName ?? 'View quote'}</span>
            <span className="shrink-0 text-[12px] font-medium text-primary">Open</span>
          </a>
        )}

        {/* Action selector */}
        {!action ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAction('approve')}
              className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success transition-colors hover:bg-success/20"
            >
              <CheckCircle className="size-4" /> Approve
            </button>
            <button
              onClick={() => setAction('reject')}
              className="flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              <XCircle className="size-4" /> Reject
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button onClick={() => { setAction(null); setError(null) }} className="text-muted-foreground/70 hover:text-muted-foreground">
                <ArrowLeft className="size-4" />
              </button>
              <span className={`text-sm font-medium ${action === 'approve' ? 'text-success' : 'text-destructive'}`}>
                {action === 'approve' ? 'Approving request' : 'Rejecting request'}
              </span>
            </div>

            {action === 'approve' && (
              <div>
                <label className={labelCls}>PO Code <span className="text-destructive">*</span></label>
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
                {action === 'reject' && <span className="text-destructive">*</span>}
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
    </div>,
    document.body
  )
}

// ── Submit Form ────────────────────────────────────────────────────────────────

const MAX_QUOTE_BYTES = 20 * 1024 * 1024

function SubmitForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useAuth()
  const [site, setSite]         = useState<string>('')
  const [supplier, setSupplier] = useState('')
  const [description, setDesc]  = useState('')
  const [urgency, setUrgency]   = useState('Routine')
  const [value, setValue]       = useState('')
  const [quote, setQuote]       = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)
  const fileRef                 = useRef<HTMLInputElement>(null)

  function pickFile(f: File | null) {
    if (f && f.size > MAX_QUOTE_BYTES) {
      setError('Quote file must be 20 MB or smaller.')
      return
    }
    setError(null)
    setQuote(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!site || !supplier.trim() || !description.trim() || !urgency || !value) {
      setError('Please fill in all required fields.'); return
    }
    if (!quote) { setError('Please attach the supplier quote.'); return }
    const v = parseFloat(value)
    if (isNaN(v) || v <= 0) { setError('Enter a valid order value.'); return }

    setSubmitting(true); setError(null)
    const form = new FormData()
    form.append('description', description.trim())
    form.append('site', site)
    form.append('supplier', supplier.trim())
    form.append('urgency', urgency)
    form.append('value', String(v))
    form.append('quote', quote)

    const res = await fetch('/api/purchase-orders', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); setSubmitting(false); return }

    setSuccess('Request submitted successfully.')
    setSite(''); setSupplier(''); setDesc(''); setUrgency('Routine'); setValue('')
    setQuote(null)
    if (fileRef.current) fileRef.current.value = ''
    setSubmitting(false)
    onSubmitted()
  }

  return (
    <div className="mx-auto max-w-xl">
      {error   && <StatusBanner variant="error"   onDismiss={() => setError(null)}   className="mb-5">{error}</StatusBanner>}
      {success && <StatusBanner variant="success" onDismiss={() => setSuccess(null)} className="mb-5">{success}</StatusBanner>}

      <form onSubmit={handleSubmit} className="surface-card space-y-5 p-6">
        <p className="text-[13px] text-muted-foreground">Submitting as {user?.name}</p>

        {/* Site */}
        <div>
          <label className={labelCls}>Site <span className="text-destructive">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {SITES.map(s => (
              <button
                key={s} type="button" onClick={() => setSite(s)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                  site === s
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Supplier */}
        <div>
          <label htmlFor="supplier" className={labelCls}>Supplier <span className="text-destructive">*</span></label>
          <input
            id="supplier" type="text" value={supplier}
            onChange={e => setSupplier(e.target.value)}
            placeholder="Supplier name"
            className={inputCls}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className={labelCls}>Description / Purpose <span className="text-destructive">*</span></label>
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
            <label htmlFor="value" className={labelCls}>Order Value (€) <span className="text-destructive">*</span></label>
            <input
              id="value" type="number" min="0.01" step="0.01"
              value={value} onChange={e => setValue(e.target.value)}
              placeholder="0.00" className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="urgency" className={labelCls}>Urgency <span className="text-destructive">*</span></label>
            <select id="urgency" value={urgency} onChange={e => setUrgency(e.target.value)} className={inputCls}>
              {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Quote document */}
        <div>
          <label className={labelCls}>Quote document <span className="text-destructive">*</span></label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.heic"
            className="hidden"
            onChange={e => pickFile(e.target.files?.[0] ?? null)}
          />
          {quote ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-3.5 py-3">
              <FileText className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{quote.name}</p>
                <p className="text-[11px] text-muted-foreground">{(quote.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                type="button"
                onClick={() => { setQuote(null); if (fileRef.current) fileRef.current.value = '' }}
                className="shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground"
                aria-label="Remove file"
              >
                <XCircle className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Upload className="size-4" />
              Attach quote (PDF, image, or document)
            </button>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground/70">Required — max 20 MB. The approver reviews this before issuing a PO number.</p>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Request'}
        </Button>
      </form>
    </div>
  )
}

// ── Order Status List ──────────────────────────────────────────────────────────

function OrderStatusList({ pos, loading, isAdmin, onReview }: {
  pos: PoRequest[]
  loading: boolean
  isAdmin: boolean
  onReview: (po: PoRequest) => void
}) {
  const { user } = useAuth()
  const [siteFilter, setSiteFilter] = useState<SiteFilter>('All')

  const filtered = siteFilter === 'All' ? pos : pos.filter(p => p.site === siteFilter)
  const pending  = pos.filter(p => p.status === 'Pending Review')
  const approved = pos.filter(p => p.status === 'Approved')

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',    value: pos.length,      cls: 'text-foreground'       },
          { label: 'Pending',  value: pending.length,  cls: pending.length > 0 ? 'text-warning' : 'text-muted-foreground' },
          { label: 'Approved', value: approved.length, cls: 'text-success' },
        ].map(({ label, value, cls }, i) => (
          <article key={label} className={`surface-card animate-page p-4 stagger-${i + 1 as 1 | 2 | 3}`}>
            <div className="text-caption text-muted-foreground">{label}</div>
            <div className={`mt-1 text-2xl font-light ${cls}`}>{loading ? '…' : value}</div>
          </article>
        ))}
      </div>

      {/* Site filter */}
      <div className="inline-flex rounded-xl bg-muted/60 p-1">
        {(['All', 'Bishopstown', 'Churchfield'] as SiteFilter[]).map(s => (
          <button
            key={s} onClick={() => setSiteFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
              siteFilter === s ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground/70">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="surface-card py-10 text-center text-sm text-muted-foreground/70">No requests yet.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((po, idx) => {
            const urgBadge = URGENCY_CLS[po.urgency] ?? 'bg-muted text-muted-foreground'
            const isApproved = po.status === 'Approved'
            const isPending  = po.status === 'Pending Review'
            const isRejected = po.status === 'Rejected'

            return (
              <article
                key={po.id}
                className={`surface-card animate-page overflow-hidden rounded-2xl transition-transform duration-200 ease-out hover:-translate-y-px ${
                  isApproved ? 'ring-1 ring-inset ring-success/25' :
                  isPending  ? 'ring-1 ring-inset ring-warning/20'   : ''
                }`}
                style={{ animationDelay: `${Math.min(idx * 50, 250)}ms` }}
              >
                {/* Approved: PO number banner */}
                {isApproved && po.poNumber && (
                  <div className="flex items-center gap-3 border-b border-success/15 bg-success/8 px-4 py-2.5">
                    <CheckCircle className="size-4 shrink-0 text-success" />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-success/70">PO Number</span>
                    <span className="font-mono text-base font-semibold tracking-wider text-success">
                      {po.poNumber}
                    </span>
                  </div>
                )}

                {/* Pending: awaiting banner */}
                {isPending && (
                  <div className="flex items-center gap-3 border-b border-warning/15 bg-warning/6 px-4 py-2">
                    <Clock className="size-3.5 shrink-0 text-warning/70" />
                    <span className="text-[12px] text-warning/70">Awaiting approval</span>
                    {isAdmin && (
                      <Button
                        variant="secondary" size="xs"
                        className="ml-auto"
                        onClick={() => onReview(po)}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                )}

                {/* Rejected: reason banner */}
                {isRejected && (
                  <div className="flex items-start gap-3 border-b border-destructive/15 bg-destructive/6 px-4 py-2">
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive/70" />
                    <span className="text-[12px] text-destructive/70">
                      Rejected{po.adminNotes ? ` — ${po.adminNotes}` : ''}
                    </span>
                  </div>
                )}

                {/* Body */}
                <div className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{po.description}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{po.supplier}</span>
                      <span className="text-muted-foreground/70">·</span>
                      <span>{po.site}</span>
                      <span className="text-muted-foreground/70">·</span>
                      <span>{fmtDate(po.requestDate ?? po.createdTime)}</span>
                      {po.requestedBy !== user?.name && (
                        <><span className="text-muted-foreground/70">·</span><span>{po.requestedBy}</span></>
                      )}
                      {po.quoteUrl && (
                        <>
                          <span className="text-muted-foreground/70">·</span>
                          <a
                            href={po.quoteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                          >
                            <Paperclip className="size-3" /> Quote
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 font-mono text-sm text-foreground">{fmtCcy(po.value)}</span>
                  <span className={`flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium ${urgBadge}`}>
                    {po.urgency}
                  </span>
                </div>
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<PoRequest | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetchWithTimeout('/api/purchase-orders')
      if (res.ok) setPos((await res.json()).purchaseOrders ?? [])
      else setLoadError(loadErrorMessage(new Error(`Error ${res.status}`)))
    } catch (err) {
      setLoadError(loadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const pending = pos.filter(p => p.status === 'Pending Review')

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-title">Purchase Orders</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Submit and track purchase order requests.
        </p>
      </div>

      {feedback && (
        <StatusBanner variant="success" onDismiss={() => setFeedback(null)}>{feedback}</StatusBanner>
      )}

      {loadError && (
        <div className="surface-card space-y-3 p-5">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="tertiary" size="sm" onClick={() => load()}>Try again</Button>
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" className="inline-flex rounded-xl bg-muted/60 p-1">
        {([
          ['submit',   'Submit Request'],
          ['requests', `Order Status${pending.length > 0 && isAdmin ? ` (${pending.length} pending)` : ''}`],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t} role="tab" aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              tab === t
                ? 'bg-muted font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.2)]'
                : 'text-muted-foreground hover:text-foreground'
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
        <OrderStatusList
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
