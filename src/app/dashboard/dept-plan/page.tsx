'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, Trash2, Save, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { SITES } from '@/lib/portal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpsRow {
  name: string; shift: string; breakMins: string
  break1: string; break2: string; break3: string
  duties: string; extra: string
}
interface OpsSection { id: string; title: string; rows: OpsRow[] }

interface BookingEntry { time: string; activity: string }

interface DeptPlanData {
  sections: OpsSection[]
  poolBookings: BookingEntry[]
  gymBookings: BookingEntry[]
}

interface PlanMeta {
  updatedBy: string | null
  updatedAt: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_DEFS = [
  { id: 'duty_managers',    title: 'Duty Managers' },
  { id: 'pool_supervisor',  title: 'Pool Supervisor' },
  { id: 'shift_supervisor', title: 'Shift Supervisor' },
  { id: 'pool',             title: 'Pool' },
  { id: 'reception_super',  title: 'Reception Supervisor' },
  { id: 'reception',        title: 'Reception' },
  { id: 'gym_supervisor',   title: 'Gym Supervisor' },
  { id: 'gym',              title: 'Gym' },
  { id: 'maintenance',      title: 'Maintenance' },
]

const inputCls = 'w-full rounded-sm border border-white/10 bg-slate-900/80 px-2 py-1.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset font-mono'

function emptyRow(): OpsRow {
  return { name: '', shift: '', breakMins: '', break1: '', break2: '', break3: '', duties: '', extra: '' }
}
function emptyBooking(): BookingEntry { return { time: '', activity: '' } }
function blankPlan(): DeptPlanData {
  return {
    sections: SECTION_DEFS.map(s => ({ ...s, rows: [emptyRow()] })),
    poolBookings: [],
    gymBookings: [],
  }
}

// ── Break helpers (same rules as ops log) ─────────────────────────────────────

function parseShiftHours(shift: string): number | null {
  const m = shift.match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/)
  if (!m) return null
  const start = Number(m[1]) * 60 + Number(m[2])
  let end = Number(m[3]) * 60 + Number(m[4])
  if (end <= start) end += 24 * 60
  return (end - start) / 60
}

function breakEntitlement(shift: string): { mins: string; detail: string } {
  const hours = parseShiftHours(shift)
  if (hours === null) return { mins: '', detail: '' }
  if (hours <= 4)  return { mins: '0',  detail: 'No break entitlement (4h or less)' }
  if (hours < 6)   return { mins: '15', detail: '1 × 15 min (unpaid)' }
  if (hours <= 8)  return { mins: '45', detail: '30 min unpaid + 1 × 15 min paid' }
  if (hours <= 10) return { mins: '60', detail: '30 min unpaid + 2 × 15 min paid' }
  return { mins: '75', detail: '45 min unpaid + 2 × 15 min paid' }
}

function mergeSavedSections(saved: DeptPlanData): OpsSection[] {
  return SECTION_DEFS.map(def => {
    const found = saved.sections?.find(s => s.id === def.id) ?? { ...def, rows: [emptyRow()] }
    return { ...found, rows: found.rows.map(r => r.shift ? { ...r, breakMins: breakEntitlement(r.shift).mins } : r) }
  })
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatStamp(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Row editor (same layout as ops log) ───────────────────────────────────────

function OpsRowEditor({ row, onChange, onRemove }: {
  row: OpsRow; onChange: (r: OpsRow) => void; onRemove: () => void
}) {
  const set = (k: keyof OpsRow) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...row, [k]: e.target.value })
  const entitlement = breakEntitlement(row.shift)
  const setShift = (e: React.ChangeEvent<HTMLInputElement>) => {
    const shift = e.target.value
    onChange({ ...row, shift, breakMins: breakEntitlement(shift).mins })
  }
  return (
    <div className="grid gap-1 items-center" style={{ gridTemplateColumns: '1.3fr 1fr 0.55fr 0.7fr 0.7fr 0.7fr 1.6fr 1.2fr auto' }}>
      <input aria-label="Staff name"                      className={inputCls} placeholder="Name"           value={row.name}     onChange={set('name')} />
      <input aria-label="Shift time (e.g. 06:30–13:30)"  className={inputCls} placeholder="06:30-13:30"    value={row.shift}    onChange={setShift} />
      <input aria-label="Break entitlement (auto-calculated)" className={`${inputCls} text-white/40 cursor-default`} placeholder="—" value={row.breakMins}
        readOnly tabIndex={-1} title={entitlement.detail || 'Auto-calculated from shift'} />
      <input aria-label="First 15-minute break time"     className={inputCls} placeholder="x"              value={row.break1}   onChange={set('break1')} />
      <input aria-label="30-minute break time"           className={inputCls} placeholder="x"              value={row.break2}   onChange={set('break2')} />
      <input aria-label="Second 15-minute break time"    className={inputCls} placeholder="x"              value={row.break3}   onChange={set('break3')} />
      <input aria-label="Duties and notes"               className={inputCls} placeholder="Duties / notes" value={row.duties}   onChange={set('duties')} />
      <input aria-label="Cover or extra duties"          className={inputCls} placeholder="Cover / extra"  value={row.extra}    onChange={set('extra')} />
      <button
        onClick={onRemove}
        aria-label="Remove row"
        className="flex size-8 shrink-0 items-center justify-center rounded text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

// ── Booking row editor ────────────────────────────────────────────────────────

function BookingRowEditor({ booking, onChange, onRemove }: {
  booking: BookingEntry; onChange: (b: BookingEntry) => void; onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="size-3.5 text-white/25 shrink-0" />
      <input
        type="time"
        aria-label="Booking time"
        value={booking.time}
        onChange={e => onChange({ ...booking, time: e.target.value })}
        className="w-28 shrink-0 rounded-sm border border-white/10 bg-slate-900/80 px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
      />
      <input
        type="text"
        aria-label="Booking description"
        value={booking.activity}
        onChange={e => onChange({ ...booking, activity: e.target.value })}
        placeholder="e.g. School Group – St Patrick's NS, Private Lesson…"
        className={`${inputCls} flex-1`}
      />
      <button
        onClick={onRemove}
        aria-label="Remove booking"
        className="flex size-8 shrink-0 items-center justify-center rounded text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeptPlanPage() {
  const [date, setDate]     = useState(todayKey())
  const [siteId, setSiteId] = useState<number>(SITES[0].id)
  const [plan, setPlan]     = useState<DeptPlanData>(blankPlan())
  const [meta, setMeta]     = useState<PlanMeta>({ updatedBy: null, updatedAt: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [dirty, setDirty]     = useState(false)
  const [flash, setFlash]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetchPlan = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/dept-plan?date=${date}&siteId=${siteId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.plan) {
        const saved = json.plan as DeptPlanData
        setPlan({
          sections: mergeSavedSections(saved),
          poolBookings: saved.poolBookings ?? [],
          gymBookings: saved.gymBookings ?? [],
        })
        setMeta({ updatedBy: json.updatedBy ?? null, updatedAt: json.updatedAt ?? null })
      } else {
        setPlan(blankPlan())
        setMeta({ updatedBy: null, updatedAt: null })
      }
      setDirty(false)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [date, siteId])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  const savePlan = useCallback(async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/dept-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, siteId, data: plan }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setMeta({ updatedBy: json.updatedBy ?? null, updatedAt: json.updatedAt ?? null })
      setDirty(false); setFlash(true)
      setTimeout(() => setFlash(false), 2000)
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }, [date, siteId, plan])

  const updateSection = (sectionId: string, rows: OpsRow[]) => {
    setPlan(p => ({ ...p, sections: p.sections.map(s => s.id === sectionId ? { ...s, rows } : s) }))
    setDirty(true)
  }

  const updateBookings = (key: 'poolBookings' | 'gymBookings', entries: BookingEntry[]) => {
    setPlan(p => ({ ...p, [key]: entries }))
    setDirty(true)
  }

  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const opsLogHref = `/dashboard/ops-log?date=${date}&siteId=${siteId}`

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-title">Department Plan</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="plan-site-select" className="sr-only">Site</label>
          <select
            id="plan-site-select"
            value={siteId}
            onChange={e => setSiteId(Number(e.target.value))}
            className="h-9 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-white font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label htmlFor="plan-date-input" className="sr-only">Date</label>
          <input
            id="plan-date-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-9 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-white font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <button
            onClick={fetchPlan}
            disabled={loading}
            aria-label="Refresh plan"
            className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-white/50 hover:text-white disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status / action bar */}
      <div className="rounded-xl bg-white/[0.035] px-4 py-3 ring-[0.5px] ring-inset ring-white/[0.07] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-mono text-white/70">{dayLabel}</span>
          {dirty && <span className="text-xs font-mono text-amber-400">Unsaved changes</span>}
          {!dirty && meta.updatedAt && (
            <span className="text-xs font-mono text-white/30">
              Last saved by {meta.updatedBy} · {formatStamp(meta.updatedAt)}
            </span>
          )}
          {!dirty && !meta.updatedAt && !loading && (
            <span className="text-xs font-mono text-white/30">No plan saved for this day yet</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={savePlan}
            disabled={saving || !dirty}
            className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2 text-sm text-white/60 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Save className="size-3.5" />
            {saving ? 'Saving…' : flash ? 'Saved ✓' : 'Save plan'}
          </button>
          <Link
            href={opsLogHref}
            className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 transition-colors font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            Open Ops Log <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Info banner */}
      <div role="note" className="rounded-xl bg-blue-500/10 px-4 py-3 text-[13px] text-blue-300/80 ring-1 ring-inset ring-blue-500/20">
        Plan who is working and what bookings are scheduled. The Duty Manager can load this plan into the Ops Log to pre-populate it before approving and printing.
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-white/[0.08] bg-white/[0.03] p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">

          {/* Column headers — visible on sm+ where the grid fits without scrolling */}
          <div
            aria-hidden="true"
            className="hidden sm:grid gap-1 px-px sticky top-0 z-10 bg-[oklch(0.14_0.012_255)]/95 backdrop-blur-sm py-2 -my-2"
            style={{ gridTemplateColumns: '1.3fr 1fr 0.55fr 0.7fr 0.7fr 0.7fr 1.6fr 1.2fr auto' }}
          >
            {['Name', 'Shift', 'Breaks', '1st 15', '30 min', '2nd 15', 'Duties', 'Cover / Extra', ''].map((h, i) => (
              <span key={i} className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/30 px-2">{h}</span>
            ))}
          </div>

          {/* Sections */}
          {plan.sections.map(section => (
            <section key={section.id} className="rounded-xl bg-white/[0.035] ring-[0.5px] ring-inset ring-white/[0.07]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">{section.title}</span>
                <button
                  onClick={() => updateSection(section.id, [...section.rows, emptyRow()])}
                  aria-label={`Add staff row to ${section.title}`}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Plus className="size-3" /> Add row
                </button>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[700px] p-3 space-y-1.5">
                  {section.rows.length === 0
                    ? <p className="text-xs text-white/30 italic px-2 py-1">No staff planned</p>
                    : section.rows.map((row, i) => (
                      <OpsRowEditor
                        key={i}
                        row={row}
                        onChange={updated => updateSection(section.id, section.rows.map((r, j) => j === i ? updated : r))}
                        onRemove={() => updateSection(section.id, section.rows.filter((_, j) => j !== i))}
                      />
                    ))}
                </div>
              </div>
            </section>
          ))}

          {/* Structured bookings */}
          {(['poolBookings', 'gymBookings'] as const).map(key => (
            <section key={key} className="rounded-xl bg-white/[0.035] ring-[0.5px] ring-inset ring-white/[0.07]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  {key === 'poolBookings' ? 'Pool bookings' : 'Gym bookings'}
                </span>
                <button
                  onClick={() => updateBookings(key, [...plan[key], emptyBooking()])}
                  aria-label={`Add ${key === 'poolBookings' ? 'pool' : 'gym'} booking`}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Plus className="size-3" /> Add booking
                </button>
              </div>
              <div className="p-3 space-y-2">
                {plan[key].length === 0 ? (
                  <p className="text-xs text-white/30 italic px-2 py-1">No bookings planned — click Add booking</p>
                ) : (
                  plan[key].map((booking, i) => (
                    <BookingRowEditor
                      key={i}
                      booking={booking}
                      onChange={updated => updateBookings(key, plan[key].map((b, j) => j === i ? updated : b))}
                      onRemove={() => updateBookings(key, plan[key].filter((_, j) => j !== i))}
                    />
                  ))
                )}
              </div>
            </section>
          ))}

          {/* Footer CTA */}
          <div className="rounded-xl bg-white/[0.035] px-4 py-4 ring-[0.5px] ring-inset ring-white/[0.07] flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm text-white">Ready? Open the Ops Log to load this plan.</p>
              <p className="mt-0.5 text-xs text-white/40">The Duty Manager can merge this plan and make final adjustments before approving and printing.</p>
            </div>
            <Link
              href={opsLogHref}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300 hover:bg-emerald-500/20 transition-colors font-mono whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              Open Ops Log <ArrowRight className="size-3.5" />
            </Link>
          </div>

        </div>
      )}
    </div>
  )
}
