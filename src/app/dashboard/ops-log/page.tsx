'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw, Plus, Trash2, Save, Copy, Printer, Lock, History, ChevronDown, ChevronUp, Download } from 'lucide-react'
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

interface ChangeEntry {
  changed_by: string
  changed_at: string
  section: string
  staff_name: string
  field: string
  old_value: string
  new_value: string
}

interface BookingEntry { time: string; activity: string }
interface DeptPlanData { sections: OpsSection[]; poolBookings: BookingEntry[]; gymBookings: BookingEntry[] }

type LogStatus = 'draft' | 'approved'

interface LogMeta {
  status: LogStatus
  approvedBy: string | null
  approvedAt: string | null
  updatedBy: string | null
  updatedAt: string | null
}

const EMPTY_META: LogMeta = { status: 'draft', approvedBy: null, approvedAt: null, updatedBy: null, updatedAt: null }

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

function blankLog(): OpsLogData {
  return {
    sections: SECTION_DEFS.map(s => ({ ...s, rows: [emptyRow()] })),
    poolBookings: '',
    gymBookings: '',
  }
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

function mergeStoredSections(stored: OpsLogData): OpsSection[] {
  return SECTION_DEFS.map(def => {
    const found = stored.sections?.find(s => s.id === def.id) ?? { ...def, rows: [emptyRow()] }
    // Recompute break entitlement so stored rows reflect current rules
    return { ...found, rows: found.rows.map(r => r.shift ? { ...r, breakMins: breakEntitlement(r.shift).mins } : r) }
  })
}

function mergePlanIntoLog(current: OpsLogData, plan: DeptPlanData): OpsLogData {
  const sections = current.sections.map(section => {
    const planSection = plan.sections?.find(s => s.id === section.id)
    if (!planSection) return section
    const planRows = planSection.rows.filter(r => r.name.trim())
    if (planRows.length === 0) return section
    const existingNames = new Set(section.rows.map(r => r.name.trim().toLowerCase()).filter(Boolean))
    const toAdd = planRows.filter(r => !existingNames.has(r.name.trim().toLowerCase()))
    if (toAdd.length === 0) return section
    const nonEmpty = section.rows.filter(r => r.name.trim() || r.shift.trim() || r.duties.trim())
    return { ...section, rows: [...nonEmpty, ...toAdd] }
  })

  const formatBookings = (entries: BookingEntry[]) =>
    entries
      .filter(e => e.time || e.activity)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(e => [e.time, e.activity].filter(Boolean).join(' — '))
      .join('\n')

  const poolText = formatBookings(plan.poolBookings ?? [])
  const gymText  = formatBookings(plan.gymBookings ?? [])

  return {
    sections,
    poolBookings: poolText || current.poolBookings,
    gymBookings:  gymText  || current.gymBookings,
  }
}

// ── Print / export ────────────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildPrintHtml(log: OpsLogData, siteName: string, dayLabel: string, meta: LogMeta, changes: ChangeEntry[]): string {
  const sectionsHtml = log.sections.map(section => {
    const rows = section.rows.filter(r => r.name.trim() || r.shift.trim() || r.duties.trim() || r.extra.trim())
    if (rows.length === 0) return ''
    const rowsHtml = rows.map(r => {
      const detail = breakEntitlement(r.shift).detail
      return `<tr>
        <td class="name">${escapeHtml(r.name)}</td>
        <td class="mono">${escapeHtml(r.shift)}</td>
        <td class="mono center" title="${escapeHtml(detail)}">${escapeHtml(r.breakMins)}</td>
        <td class="mono center">${escapeHtml(r.break1)}</td>
        <td class="mono center">${escapeHtml(r.break2)}</td>
        <td class="mono center">${escapeHtml(r.break3)}</td>
        <td>${escapeHtml(r.duties)}</td>
        <td>${escapeHtml(r.extra)}</td>
      </tr>`
    }).join('')
    return `
      <tr class="section"><td colspan="8">${escapeHtml(section.title)}</td></tr>
      ${rowsHtml}`
  }).filter(Boolean).join('')

  const bookings = (label: string, value: string) => value.trim()
    ? `<div class="bookings"><h2>${label}</h2><p>${escapeHtml(value).replace(/\n/g, '<br>')}</p></div>`
    : ''

  const approvalLine = meta.approvedBy
    ? `Approved by ${escapeHtml(meta.approvedBy)} · ${new Date(meta.approvedAt!).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : ''

  const amendmentsHtml = changes.length > 0 ? `
  <div class="amendments">
    <h2>Amendments since approval</h2>
    <table>
      <thead><tr><th>Time</th><th>By</th><th>Section</th><th>Staff</th><th>Field</th><th>Was</th><th>Now</th></tr></thead>
      <tbody>
        ${changes.map(c => `<tr>
          <td class="mono">${new Date(c.changed_at).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
          <td>${escapeHtml(c.changed_by)}</td>
          <td>${escapeHtml(c.section)}</td>
          <td>${escapeHtml(c.staff_name)}</td>
          <td>${escapeHtml(c.field)}</td>
          <td>${escapeHtml(c.old_value)}</td>
          <td>${escapeHtml(c.new_value)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ops Log — ${escapeHtml(siteName)} — ${escapeHtml(dayLabel)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #111; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4px; }
  header h1 { font-size: 16pt; font-weight: 700; }
  header .meta { font-size: 11pt; text-align: right; }
  header .meta strong { display: block; font-size: 12pt; }
  .approval { font-size: 9pt; color: #333; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 3px 6px; text-align: left; vertical-align: middle; }
  thead th { background: #e8e8e8; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; }
  tr.section td { background: #d9d9d9; font-weight: 700; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 6px; }
  td.name { font-weight: 600; width: 13%; }
  td.mono { font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.center { text-align: center; }
  tbody tr { page-break-inside: avoid; }
  tr.section { page-break-after: avoid; }
  .bookings { margin-top: 10px; border: 1px solid #999; padding: 6px 8px; page-break-inside: avoid; }
  .bookings h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
  .bookings p { font-size: 10pt; }
  .amendments { margin-top: 12px; page-break-inside: avoid; }
  .amendments h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .amendments table td, .amendments table th { font-size: 8pt; padding: 2px 5px; }
  footer { margin-top: 8px; font-size: 8pt; color: #555; display: flex; justify-content: space-between; }
</style>
</head>
<body>
<header>
  <h1>Daily Ops Log</h1>
  <div class="meta"><strong>${escapeHtml(siteName)}</strong>${escapeHtml(dayLabel)}</div>
</header>
${approvalLine ? `<p class="approval">${approvalLine}</p>` : ''}
<table>
  <thead>
    <tr>
      <th>Name</th><th>Shift</th><th>Breaks (min)</th><th>15</th><th>30</th><th>15</th><th>Duties</th><th>Cover / Extra</th>
    </tr>
  </thead>
  <tbody>${sectionsHtml}</tbody>
</table>
${bookings('Pool Bookings', log.poolBookings)}
${bookings('Gym Bookings', log.gymBookings)}
${amendmentsHtml}
<footer>
  <span>LeisureWorld · Manager Portal</span>
  <span>Printed ${new Date().toLocaleString('en-IE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
</footer>
</body>
</html>`
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function prevDayKey(dateKey: string) {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatStamp(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Row editor ────────────────────────────────────────────────────────────────

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

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: LogStatus }) {
  const cls = status === 'approved'
    ? 'text-green-400 border-green-600/40 bg-green-500/10'
    : 'text-amber-400 border-amber-500/40 bg-amber-500/10'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-mono tracking-widest uppercase whitespace-nowrap ${cls}`}>
      {status === 'approved' && <Lock className="w-3 h-3" />}
      {status === 'approved' ? 'Approved' : 'Draft'}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OpsLogPage() {
  const params = useSearchParams()
  const [date, setDate]       = useState(() => params.get('date') ?? todayKey())
  const [siteId, setSiteId]   = useState<number>(() => {
    const p = params.get('siteId')
    return p ? Number(p) : SITES[0].id
  })
  const [log, setLog]         = useState<OpsLogData>(blankLog())
  const [meta, setMeta]       = useState<LogMeta>(EMPTY_META)
  const [changes, setChanges] = useState<ChangeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [dirty, setDirty]     = useState(false)
  const [flash, setFlash]     = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [planBanner, setPlanBanner]   = useState<string | null>(null)

  const isApproved = meta.status === 'approved'

  const applyResponse = useCallback((json: Record<string, unknown>) => {
    setMeta({
      status: (json.status as LogStatus) ?? 'draft',
      approvedBy: (json.approvedBy as string) ?? null,
      approvedAt: (json.approvedAt as string) ?? null,
      updatedBy: (json.updatedBy as string) ?? null,
      updatedAt: (json.updatedAt as string) ?? null,
    })
    setChanges((json.changes as ChangeEntry[]) ?? [])
  }, [])

  const fetchLog = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/ops-log?date=${date}&siteId=${siteId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.log) {
        const stored: OpsLogData = json.log
        setLog({ sections: mergeStoredSections(stored), poolBookings: stored.poolBookings ?? '', gymBookings: stored.gymBookings ?? '' })
        applyResponse(json)
      } else {
        setLog(blankLog())
        setMeta(EMPTY_META)
        setChanges([])
      }
      setDirty(false)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [date, siteId, applyResponse])

  useEffect(() => { fetchLog() }, [fetchLog])

  const persist = useCallback(async (action: 'save' | 'approve') => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/ops-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, siteId, data: log, action }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      applyResponse(json)
      setDirty(false); setFlash(true)
      setTimeout(() => setFlash(false), 2000)
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }, [date, siteId, log, applyResponse])

  const approve = useCallback(() => {
    if (!window.confirm('Approve and lock this ops log? After approval, any further edits will be recorded in the change history.')) return
    persist('approve')
  }, [persist])

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

  const loadPlan = useCallback(async () => {
    setLoadingPlan(true); setError(null)
    try {
      const res = await fetch(`/api/dept-plan?date=${date}&siteId=${siteId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.plan) { setError('No department plan found for this date. Create one in the Dept Plan page first.'); return }
      setLog(l => mergePlanIntoLog(l, json.plan as DeptPlanData))
      setPlanBanner(`Loaded from dept plan (saved by ${json.updatedBy ?? 'supervisor'} · ${formatStamp(json.updatedAt)})`)
      setDirty(true)
    } catch (e) { setError(String(e)) }
    finally { setLoadingPlan(false) }
  }, [date, siteId])

  const updateSection = (sectionId: string, rows: OpsRow[]) => {
    setLog(l => ({ ...l, sections: l.sections.map(s => s.id === sectionId ? { ...s, rows } : s) }))
    setDirty(true)
  }

  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const staffCount = useMemo(
    () => log.sections.reduce((n, s) => n + s.rows.filter(r => r.name.trim()).length, 0),
    [log],
  )

  const printLog = useCallback(() => {
    const siteName = SITES.find(s => s.id === siteId)?.name ?? 'LeisureWorld'
    const win = window.open('', '_blank')
    if (!win) { setError('Pop-up blocked — allow pop-ups to print the ops log'); return }
    win.document.write(buildPrintHtml(log, siteName, dayLabel, meta, changes))
    win.document.close()
    win.focus()
    // Give the new window a moment to render before opening the print dialog
    setTimeout(() => win.print(), 250)
  }, [log, siteId, dayLabel, meta, changes])

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
          <button onClick={fetchLog} disabled={loading}
            className="border border-white/10 bg-slate-900/80 p-2 text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status / workflow bar */}
      <div className="border border-white/[0.08] bg-white/[0.03] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill status={meta.status} />
          <span className="text-sm font-mono text-slate-300">{dayLabel}</span>
          <span className="text-[11px] font-mono text-slate-600">{staffCount} staff assigned</span>
          {isApproved && meta.approvedBy && (
            <span className="text-[11px] font-mono text-slate-500">
              Approved by {meta.approvedBy} · {formatStamp(meta.approvedAt)}
            </span>
          )}
          {dirty && <span className="text-[11px] font-mono text-amber-400">Unsaved changes</span>}
          {!dirty && meta.updatedAt && (
            <span className="text-[11px] font-mono text-slate-600">
              Last saved by {meta.updatedBy} · {formatStamp(meta.updatedAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isApproved && (
            <button onClick={loadPlan} disabled={loadingPlan}
              title="Merge the department supervisor's plan for this day into the log"
              className="border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/20 disabled:opacity-40 transition-colors flex items-center gap-2 font-mono">
              <Download className="w-3.5 h-3.5" />
              {loadingPlan ? 'Loading…' : 'Load plan'}
            </button>
          )}
          {!isApproved && (
            <button onClick={copyPrev} title="Copy previous day as starting point"
              className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2 font-mono">
              <Copy className="w-3.5 h-3.5" /> Copy prev
            </button>
          )}
          <button onClick={() => persist('save')} disabled={saving || !dirty}
            className={`border px-4 py-2 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-mono ${
              isApproved
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                : 'border-white/10 bg-slate-900/80 text-slate-300 hover:text-white'
            }`}>
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : flash ? 'Saved ✓' : isApproved ? 'Save amendment' : 'Save draft'}
          </button>
          {!isApproved && (
            <button onClick={approve} disabled={saving || loading}
              title="Lock the log and enable printing"
              className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-30 transition-colors flex items-center gap-2 font-mono">
              <Lock className="w-3.5 h-3.5" /> Approve &amp; lock
            </button>
          )}
          <button onClick={printLog} disabled={loading || !isApproved || dirty}
            title={!isApproved ? 'The log must be approved before it can be printed' : dirty ? 'Save your changes before printing' : 'Print or save as PDF (A4)'}
            className="border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-mono">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Plan load banner */}
      {planBanner && (
        <div className="border border-blue-500/20 bg-blue-500/5 px-4 py-2.5 text-[11px] font-mono text-blue-300/90 -mt-3 flex items-center justify-between">
          <span>{planBanner}</span>
          <button onClick={() => setPlanBanner(null)} className="text-blue-400/50 hover:text-blue-300 ml-4">✕</button>
        </div>
      )}

      {/* Amendment notice */}
      {isApproved && (
        <div className="border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-[11px] font-mono text-amber-300/90 -mt-3">
          This log is approved and locked. You can still make changes during the day — every change is recorded
          in the history below with who changed it, when, and what it was before.
        </div>
      )}

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
          <div className="grid gap-1 px-px sticky top-0 z-10 bg-slate-950/95 backdrop-blur py-2 -my-2"
            style={{ gridTemplateColumns: '1.3fr 1fr 0.55fr 0.7fr 0.7fr 0.7fr 1.6fr 1.2fr auto' }}>
            {['Name', 'Shift', 'Breaks', '1st 15', '30 min', '2nd 15', 'Duties', 'Cover / Extra', ''].map((h, i) => (
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

          {/* Change history */}
          {changes.length > 0 && (
            <section className="border border-white/[0.08] bg-white/[0.03]">
              <button onClick={() => setHistoryOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] text-left">
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-400 flex items-center gap-2">
                  <History className="w-3.5 h-3.5" /> Change history · {changes.length} amendment{changes.length === 1 ? '' : 's'}
                </span>
                {historyOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>
              {historyOpen && (
                <div className="p-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        {['Time', 'By', 'Section', 'Staff', 'Field', 'Was', 'Now'].map(h => (
                          <th key={h} className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-600 px-2 py-1.5 font-normal">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((c, i) => (
                        <tr key={i} className="border-t border-white/[0.05]">
                          <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatStamp(c.changed_at)}</td>
                          <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">{c.changed_by}</td>
                          <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{c.section}</td>
                          <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">{c.staff_name}</td>
                          <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{c.field}</td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-red-300/80">{c.old_value}</td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-emerald-300/80">{c.new_value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

        </div>
      )}
    </div>
  )
}
