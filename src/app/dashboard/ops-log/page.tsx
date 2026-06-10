'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, Trash2, Save, Copy } from 'lucide-react'
import { SITES } from '@/lib/portal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpsRow {
  name: string
  shift: string
  breakMins: string
  break1: string
  break2: string
  break3: string
  duties: string
  extra: string
}

interface OpsSection {
  id: string
  title: string
  rows: OpsRow[]
}

interface OpsLogData {
  sections: OpsSection[]
  poolBookings: string
  gymBookings: string
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

const inputCls = 'w-full border border-white/10 bg-slate-900/80 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 font-mono'

function emptyRow(): OpsRow {
  return { name: '', shift: '', breakMins: '', break1: '', break2: '', break3: '', duties: '', extra: '' }
}

// ── Break entitlement rules ───────────────────────────────────────────────────
// >4h and <6h  → 15 min (one 15-min unpaid break)
// 6h–8h        → 45 min (30 unpaid + one 15-min paid)
// >8h–10h      → 60 min (30 unpaid + two 15-min paid)
// >10h         → 75 min (45 unpaid + two 15-min paid)

function parseShiftHours(shift: string): number | null {
  const m = shift.match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/)
  if (!m) return null
  const start = Number(m[1]) * 60 + Number(m[2])
  let end = Number(m[3]) * 60 + Number(m[4])
  if (end <= start) end += 24 * 60 // overnight shift
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

function blankLog(): OpsLogData {
  return {
    sections: SECTION_DEFS.map(s => ({ ...s, rows: [emptyRow()] })),
    poolBookings: '',
    gymBookings: '',
  }
}

function mergeStoredSections(stored: OpsLogData): OpsSection[] {
  return SECTION_DEFS.map(def => {
    const found = stored.sections?.find(s => s.id === def.id) ?? { ...def, rows: [emptyRow()] }
    // Recompute break entitlement so stored rows reflect current rules
    return { ...found, rows: found.rows.map(r => r.shift ? { ...r, breakMins: breakEntitlement(r.shift).mins } : r) }
  })
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function prevDayKey(dateKey: string) {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Row ───────────────────────────────────────────────────────────────────────

function OpsRowEditor({ row, onChange, onRemove }: {
  row: OpsRow
  onChange: (r: OpsRow) => void
  onRemove: () => void
}) {
  const set = (k: keyof OpsRow) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...row, [k]: e.target.value })
  const entitlement = breakEntitlement(row.shift)
  const setShift = (e: React.ChangeEvent<HTMLInputElement>) => {
    const shift = e.target.value
    onChange({ ...row, shift, breakMins: breakEntitlement(shift).mins })
  }
  return (
    <div className="grid gap-1 items-center" style={{ gridTemplateColumns: '1.3fr 1fr 0.55fr 0.7fr 0.7fr 0.7fr 1.6fr 1.2fr auto' }}>
      <input className={inputCls} placeholder="Name"           value={row.name}      onChange={set('name')} />
      <input className={inputCls} placeholder="06:30-13:30"    value={row.shift}     onChange={setShift} />
      <input className={`${inputCls} text-slate-400 cursor-default`} placeholder="—" value={row.breakMins}
        readOnly tabIndex={-1} title={entitlement.detail || 'Auto-calculated from shift'} />
      <input className={inputCls} placeholder="x"              value={row.break1}    onChange={set('break1')} />
      <input className={inputCls} placeholder="x"              value={row.break2}    onChange={set('break2')} />
      <input className={inputCls} placeholder="x"              value={row.break3}    onChange={set('break3')} />
      <input className={inputCls} placeholder="Duties / notes" value={row.duties}    onChange={set('duties')} />
      <input className={inputCls} placeholder="Cover / extra"  value={row.extra}     onChange={set('extra')} />
      <button onClick={onRemove} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OpsLogPage() {
  const [date, setDate]       = useState(todayKey())
  const [siteId, setSiteId]   = useState<number>(SITES[0].id)
  const [log, setLog]         = useState<OpsLogData>(blankLog())
  const [meta, setMeta]       = useState<{ by: string | null; at: string | null }>({ by: null, at: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [dirty, setDirty]     = useState(false)
  const [flash, setFlash]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetchLog = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/ops-log?date=${date}&siteId=${siteId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.log) {
        const stored: OpsLogData = json.log
        setLog({ sections: mergeStoredSections(stored), poolBookings: stored.poolBookings ?? '', gymBookings: stored.gymBookings ?? '' })
        setMeta({ by: json.updatedBy, at: json.updatedAt })
      } else {
        setLog(blankLog())
        setMeta({ by: null, at: null })
      }
      setDirty(false)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [date, siteId])

  useEffect(() => { fetchLog() }, [fetchLog])

  const save = useCallback(async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/ops-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, siteId, data: log }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDirty(false); setFlash(true)
      setTimeout(() => setFlash(false), 2000)
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }, [date, siteId, log])

  const copyPrev = useCallback(async () => {
    const prev = prevDayKey(date)
    try {
      const res = await fetch(`/api/ops-log?date=${prev}&siteId=${siteId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.log) { setError(`No log found for ${prev}`); return }
      const stored: OpsLogData = json.log
      setLog({ sections: mergeStoredSections(stored), poolBookings: stored.poolBookings ?? '', gymBookings: stored.gymBookings ?? '' })
      setDirty(true)
    } catch (e) { setError(String(e)) }
  }, [date, siteId])

  const updateSection = (sectionId: string, rows: OpsRow[]) => {
    setLog(l => ({ ...l, sections: l.sections.map(s => s.id === sectionId ? { ...s, rows } : s) }))
    setDirty(true)
  }

  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Operations console</div>
          <h1 className="text-3xl font-light text-white">Daily ops log</h1>
        </div>
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <select value={siteId} onChange={e => setSiteId(Number(e.target.value))}
            className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/20">
            {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/20" />
          <button onClick={copyPrev} title="Copy previous day as starting point"
            className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2 font-mono">
            <Copy className="w-3.5 h-3.5" /> Copy prev
          </button>
          <button onClick={fetchLog} disabled={loading}
            className="border border-white/10 bg-slate-900/80 p-2 text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={save} disabled={saving || !dirty}
            className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-mono">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : flash ? 'Saved ✓' : 'Save log'}
          </button>
        </div>
      </div>

      {/* Date label + last saved */}
      <div className="flex items-center justify-between flex-wrap gap-2 -mt-2">
        <p className="text-sm font-mono text-slate-400">{dayLabel}</p>
        {meta.at && (
          <p className="text-[11px] font-mono text-slate-600">
            Saved by {meta.by ?? 'unknown'} · {new Date(meta.at + 'Z').toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {dirty && <span className="text-amber-400 ml-2">· unsaved changes</span>}
          </p>
        )}
        {!meta.at && dirty && <p className="text-[11px] font-mono text-amber-400">Unsaved changes</p>}
      </div>

      {error && (
        <div className="border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-mono text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-white/[0.08] bg-white/[0.03] p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">

          {/* Column headers */}
          <div className="grid gap-1 px-px" style={{ gridTemplateColumns: '1.3fr 1fr 0.55fr 0.7fr 0.7fr 0.7fr 1.6fr 1.2fr auto' }}>
            {['Name', 'Shift', 'Breaks', '15', '30', '15', 'Duties', 'Cover / Extra', ''].map((h, i) => (
              <span key={i} className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-600 px-2">{h}</span>
            ))}
          </div>

          {/* Sections */}
          {log.sections.map(section => (
            <section key={section.id} className="border border-white/[0.08] bg-white/[0.03]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-400">{section.title}</span>
                <button onClick={() => updateSection(section.id, [...section.rows, emptyRow()])}
                  className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-600 hover:text-slate-300 transition-colors">
                  <Plus className="w-3 h-3" /> Add row
                </button>
              </div>
              <div className="p-3 space-y-1.5">
                {section.rows.length === 0
                  ? <p className="text-[11px] font-mono text-slate-600 italic px-2 py-1">No staff assigned</p>
                  : section.rows.map((row, i) => (
                    <OpsRowEditor
                      key={i}
                      row={row}
                      onChange={updated => updateSection(section.id, section.rows.map((r, j) => j === i ? updated : r))}
                      onRemove={() => updateSection(section.id, section.rows.filter((_, j) => j !== i))}
                    />
                  ))}
              </div>
            </section>
          ))}

          {/* Bookings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {([
              { key: 'poolBookings', label: 'Pool bookings' },
              { key: 'gymBookings',  label: 'Gym bookings' },
            ] as const).map(({ key, label }) => (
              <section key={key} className="border border-white/[0.08] bg-white/[0.03]">
                <div className="px-4 py-2.5 border-b border-white/[0.06]">
                  <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-400">{label}</span>
                </div>
                <div className="p-3">
                  <textarea
                    value={log[key]}
                    onChange={e => { setLog(l => ({ ...l, [key]: e.target.value })); setDirty(true) }}
                    rows={3}
                    placeholder={key === 'poolBookings' ? 'School 11:00–11:45, party bookings…' : 'Inductions, classes…'}
                    className="w-full border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 font-mono resize-y"
                  />
                </div>
              </section>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}
