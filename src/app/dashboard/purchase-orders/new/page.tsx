'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { StatusBanner } from '@/components/ui/status-banner'

const SITES = ['Bishopstown', 'Churchfield'] as const
const URGENCIES = ['Routine', 'Urgent', 'Emergency'] as const

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-ring/40'
const labelCls = 'block text-[13px] font-medium text-white/60 mb-1.5'

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [site, setSite]           = useState<string>('')
  const [supplier, setSupplier]   = useState<string>('')
  const [description, setDesc]    = useState('')
  const [urgency, setUrgency]     = useState<string>('Routine')
  const [value, setValue]         = useState('')
  const [file, setFile]           = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([])
  const [suppliersLoaded, setSuppliersLoaded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadSuppliers() {
    if (suppliersLoaded) return
    setSuppliersLoaded(true)
    const res = await fetch('/api/suppliers')
    if (res.ok) {
      const data = await res.json()
      setSuppliers(data.suppliers ?? [])
    }
  }

  function handleFile(f: File | null) {
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { setError('File must be under 10 MB'); return }
    setFile(f)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!site || !supplier || !description.trim() || !urgency || !value) {
      setError('Please fill in all required fields.')
      return
    }
    const v = parseFloat(value)
    if (isNaN(v) || v <= 0) { setError('Enter a valid order value.'); return }

    setSubmitting(true)
    setError(null)

    const form = new FormData()
    form.append('description', description.trim())
    form.append('site', site)
    form.append('supplier', supplier)
    form.append('urgency', urgency)
    form.append('value', String(v))
    if (file) form.append('quote', file)

    const res = await fetch('/api/purchase-orders', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); setSubmitting(false); return }
    router.push('/dashboard/purchase-orders')
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/purchase-orders">
          <Button variant="ghost" size="icon-sm" aria-label="Back">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-title">New PO Request</h1>
          <p className="mt-0.5 text-[13px] text-white/40">Submitting as {user?.name}</p>
        </div>
      </div>

      {error && <StatusBanner variant="error" onDismiss={() => setError(null)}>{error}</StatusBanner>}

      <form onSubmit={handleSubmit} className="surface-card space-y-5 p-6">

        {/* Site */}
        <div>
          <label className={labelCls}>Site <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {SITES.map(s => (
              <button
                key={s} type="button"
                onClick={() => setSite(s)}
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
          <select
            id="supplier"
            value={supplier}
            onChange={e => setSupplier(e.target.value)}
            onFocus={loadSuppliers}
            className={inputCls}
          >
            <option value="" disabled>Select a supplier…</option>
            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className={labelCls}>Description / Purpose <span className="text-red-400">*</span></label>
          <textarea
            id="description"
            rows={3}
            value={description}
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
              placeholder="0.00"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="urgency" className={labelCls}>Urgency <span className="text-red-400">*</span></label>
            <select id="urgency" value={urgency} onChange={e => setUrgency(e.target.value)} className={inputCls}>
              {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Quote upload */}
        <div>
          <label className={labelCls}>Quote / Document</label>
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <FileText className="size-4 shrink-0 text-white/40" />
              <span className="min-w-0 flex-1 truncate text-sm text-white/70">{file.name}</span>
              <span className="shrink-0 text-xs text-white/30">{(file.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => setFile(null)} className="shrink-0 text-white/30 hover:text-white/60">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-white/40 transition-colors hover:border-white/25 hover:text-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Upload className="size-5" />
              <span className="text-sm">Click to attach quote (PDF, image · max 10 MB)</span>
            </button>
          )}
          <input
            ref={fileRef} type="file" className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Request'}
        </Button>
      </form>
    </div>
  )
}
