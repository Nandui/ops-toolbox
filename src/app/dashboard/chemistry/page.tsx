'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { FlaskConical, RefreshCw, AlertTriangle, CheckCircle, XCircle, Thermometer } from 'lucide-react'
interface Reading {
time: string
siteId: number
siteName: string
poolLabel: string
freeChlorine: number | null
totalChlorine: number | null
combinedChlorine: number | null
ph: number | null
waterTemp: number | null
// CO2/stock fields
mpLpChlorine: number | null
mpCo2: number | null
lpCo2: number | null
eighteenMChlorine: number | null
eighteenMCo2: number | null
}
// Thresholds per HSE guidance
const THRESHOLDS = {
freeChlorine: { low: 0.5, high: 3.0, label: 'Free Cl₂', unit: 'ppm' },
totalChlorine: { low: 1.0, high: 4.0, label: 'Total Cl₂', unit: 'ppm' },
combinedChlorine: { low: 0, high: 1.0, label: 'Combined Cl₂', unit: 'ppm' },
ph: { low: 7.2, high: 7.8, label: 'pH', unit: '' },
waterTemp: { low: 26, high: 32, label: 'Temp', unit: '°C' },
}
type MetricKey = keyof typeof THRESHOLDS
type ReadingSeriesKey =
| 'freeChlorine'
| 'totalChlorine'
| 'combinedChlorine'
| 'ph'
| 'waterTemp'
| 'mpLpChlorine'
| 'mpCo2'
| 'lpCo2'
| 'eighteenMChlorine'
| 'eighteenMCo2'
type ViewMode = 'hour' | 'day' | 'month'
type SeriesOption = {
key: ReadingSeriesKey
label: string
color: string
metric?: MetricKey
unit?: string
}
type TimeWindow = {
start: Date
end: Date
label: string
}
function getStatus(value: number | null, key: MetricKey) {
if (value === null) return 'unknown'
const t = THRESHOLDS[key]
if (value < t.low || value > t.high) return 'danger'
if (value < t.low + (t.high - t.low) * 0.15 || value > t.high - (t.high - t.low) * 0.15) return 'warning'
return 'ok'
}
function formatTime(iso: string) {
return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
}
function formatDateKey(date: Date) {
const y = date.getFullYear()
const m = String(date.getMonth() + 1).padStart(2, '0')
const d = String(date.getDate()).padStart(2, '0')
return `${y}-${m}-${d}`
}
function formatMonthKey(date: Date) {
const y = date.getFullYear()
const m = String(date.getMonth() + 1).padStart(2, '0')
return `${y}-${m}`
}
function parseDateInput(value: string) {
const [year, month, day] = value.split('-').map(Number)
return new Date(year, month - 1, day)
}
function parseMonthInput(value: string) {
const [year, month] = value.split('-').map(Number)
return new Date(year, month - 1, 1)
}
function startOfDay(date: Date) {
return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}
function endOfDay(date: Date) {
return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}
function startOfHour(date: Date, hour: number) {
return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0)
}
function endOfHour(date: Date, hour: number) {
return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 59, 59, 999)
}
function startOfMonth(date: Date) {
return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}
function endOfMonth(date: Date) {
return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}
function sameDay(a: Date, b: Date) {
return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function sameMonth(a: Date, b: Date) {
return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}
function getField(records: Record<string, any>[], fieldName: string): number | null {
for (const rec of records) {
const field = rec[fieldName]
if (field && field.value !== undefined && field.value !== null && field.value !== '') {
const num = Number(field.value)
if (!Number.isNaN(num)) return num
}
}
return null
}
function isCO2Stock(name: string) {
return /chlorine.*co2/i.test(name) || /co2.*chlorine/i.test(name) || /🛢️/u.test(name)
}
function clamp01(value: number) {
return Math.max(0, Math.min(1, value))
}
function formatMetricValue(value: number, metric?: MetricKey, unit?: string) {
if (metric === 'ph') return value.toFixed(1)
if (metric === 'waterTemp') return `${value.toFixed(1)}${unit ?? '°C'}`
return `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`
}
function getSeriesBounds(readings: Reading[], key: ReadingSeriesKey, metric?: MetricKey) {
const values = readings
.map(r => r[key])
.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
if (values.length === 0) return { min: 0, max: 1 }
if (metric) {
const t = THRESHOLDS[metric]
const span = t.high - t.low
const pad = span * 0.35 || 1
return { min: t.low - pad, max: t.high + pad }
}
const min = Math.min(...values)
const max = Math.max(...values)
if (min === max) return { min: min - 1, max: max + 1 }
const pad = (max - min) * 0.2 || 1
return { min: min - pad, max: max + pad }
}
function normalizeValue(value: number | null, bounds: { min: number; max: number }) {
if (value === null) return null
const span = bounds.max - bounds.min || 1
return clamp01((value - bounds.min) / span)
}
function buildChartWindow(mode: ViewMode, anchorDate: string, anchorHour: number): TimeWindow {
const base = parseDateInput(anchorDate)
if (mode === 'hour') {
const start = startOfHour(base, anchorHour)
const end = endOfHour(base, anchorHour)
return {
start,
end,
label: `${start.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })} · ${String(anchorHour).padStart(2, '0')}:00`,
}
}
if (mode === 'month') {
const monthDate = parseMonthInput(formatMonthKey(base))
return {
start: startOfMonth(monthDate),
end: endOfMonth(monthDate),
label: monthDate.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' }),
}
}
return {
start: startOfDay(base),
end: endOfDay(base),
label: base.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
}
}
function buildFetchRange(mode: ViewMode, anchorDate: string) {
const base = parseDateInput(anchorDate)
if (mode === 'month') {
const monthDate = parseMonthInput(formatMonthKey(base))
return {
startDate: formatDateKey(startOfMonth(monthDate)),
endDate: formatDateKey(endOfMonth(monthDate)),
}
}
return {
startDate: formatDateKey(startOfDay(base)),
endDate: formatDateKey(endOfDay(base)),
}
}
function filterReadings(readings: Reading[], mode: ViewMode, anchorDate: string, anchorHour: number) {
const base = parseDateInput(anchorDate)
const hourStart = startOfHour(base, anchorHour)
const hourEnd = endOfHour(base, anchorHour)
return readings.filter(r => {
const readingDate = new Date(r.time)
if (mode === 'hour') return readingDate >= hourStart && readingDate <= hourEnd
if (mode === 'month') return sameMonth(readingDate, base)
return sameDay(readingDate, base)
})
}
function getSeriesOptions(isStock: boolean): SeriesOption[] {
return isStock
? [
{ key: 'mpLpChlorine', label: 'MP & LP Cl₂', color: 'text-emerald-400' },
{ key: 'eighteenMChlorine', label: '18m Cl₂', color: 'text-cyan-400' },
{ key: 'mpCo2', label: 'MP CO₂', color: 'text-amber-400' },
{ key: 'lpCo2', label: 'LP CO₂', color: 'text-purple-400' },
{ key: 'eighteenMCo2', label: '18m CO₂', color: 'text-rose-400' },
]
: [
{ key: 'freeChlorine', label: 'Free Cl₂', color: 'text-emerald-400', metric: 'freeChlorine', unit: 'ppm' },
{ key: 'totalChlorine', label: 'Total Cl₂', color: 'text-cyan-400', metric: 'totalChlorine', unit: 'ppm' },
{ key: 'combinedChlorine', label: 'Combined Cl₂', color: 'text-amber-400', metric: 'combinedChlorine', unit: 'ppm' },
{ key: 'ph', label: 'pH', color: 'text-purple-400', metric: 'ph' },
{ key: 'waterTemp', label: 'Temp', color: 'text-rose-400', metric: 'waterTemp', unit: '°C' },
]
}
function getSeriesValueLabel(series: SeriesOption, value: number | null) {
if (value === null) return '—'
return formatMetricValue(value, series.metric, series.unit)
}
function TimeSeriesChart({
readings,
series,
title,
mode,
window,
}: {
readings: Reading[]
series: SeriesOption
title: string
mode: ViewMode
window: TimeWindow
}) {
const points = [...readings].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
const numericValues = points.map(r => r[series.key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
if (points.length === 0 || numericValues.length === 0) {
return (
<div className="px-5 py-4 border-b border-slate-800/60 bg-slate-950/30">
<div className="flex items-center justify-between gap-4 mb-2">
<div>
<h3 className="text-sm font-semibold text-white">{title}</h3>
<p className="text-xs text-slate-500">{window.label}</p>
</div>
</div>
<div className="text-sm text-slate-500 py-10 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
No readings in this time window
</div>
</div>
)
}
const width = 720
const height = 280
const padX = 56
const padY = 22
const plotW = width - padX * 2
const plotH = height - padY * 2
const bounds = getSeriesBounds(points, series.key, series.metric)
const range = Math.max(1, window.end.getTime() - window.start.getTime())
const minValue = bounds.min
const maxValue = bounds.max
const span = maxValue - minValue || 1
const coords = points
.map((point, index) => {
const value = point[series.key]
if (value === null || !Number.isFinite(value)) return null
const time = new Date(point.time)
if (Number.isNaN(time.getTime())) return null
const x = padX + clamp01((time.getTime() - window.start.getTime()) / range) * plotW
const yNorm = normalizeValue(value, bounds)
if (yNorm === null) return null
const y = padY + plotH - yNorm * plotH
return { x, y, time, value, index }
})
.filter((point): point is { x: number; y: number; time: Date; value: number; index: number } => point !== null)
const path = coords.length >= 2 ? coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : ''
const yTicks = Array.from({ length: 5 }, (_, i) => {
const ratio = i / 4
const value = maxValue - span * ratio
const y = padY + plotH * ratio
return { value, y }
})
const xTicks = Array.from({ length: 5 }, (_, i) => {
const ratio = i / 4
const time = new Date(window.start.getTime() + range * ratio)
const x = padX + plotW * ratio
return { time, x }
})
const target = series.metric ? THRESHOLDS[series.metric] : null
const targetLowY = target ? padY + plotH - clamp01((target.low - minValue) / span) * plotH : null
const targetHighY = target ? padY + plotH - clamp01((target.high - minValue) / span) * plotH : null
const latest = points[points.length - 1]
const low = Math.min(...numericValues)
const high = Math.max(...numericValues)
const avg = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
const latestStatus = series.metric ? getStatus(latest[series.key], series.metric) : 'ok'
const latestStatusLabel = latestStatus === 'danger' ? 'Out of range' : latestStatus === 'warning' ? 'Watch' : 'In range'
const xLabel = (time: Date) => {
if (mode === 'hour') {
return time.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
}
if (mode === 'month') {
return time.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
}
return time.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
}
const yLabel = (value: number) => formatMetricValue(value, series.metric, series.unit)
return (
<div className="px-4 md:px-5 py-4 border-b border-slate-800/60 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,rgba(9,9,11,0.95),rgba(24,24,27,0.92))]">
<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between mb-3">
<div className="space-y-1">
<div className="flex flex-wrap items-center gap-2 text-[11px]">
<span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-300">
<span className={`w-2 h-2 rounded-full ${series.color}`} />
Live trend
</span>
<span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-slate-400">
{window.label}
</span>
{target && (
<span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
Target {formatMetricValue(target.low, series.metric, series.unit)}–{formatMetricValue(target.high, series.metric, series.unit)}
</span>
)}
</div>
<div>
<h3 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h3>
<p className="text-xs text-slate-500">{series.label} · {latestStatusLabel}</p>
</div>
</div>
<div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
<span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${latestStatus === 'danger' ? 'border-red-500/20 bg-red-500/10 text-red-300' : latestStatus === 'warning' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
<span className={`w-1.5 h-1.5 rounded-full ${series.color}`} />
{getSeriesValueLabel(series, latest[series.key])}
</span>
<span className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-500">
Avg {formatMetricValue(avg, series.metric, series.unit)}
</span>
<span className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-500">
Min {formatMetricValue(low, series.metric, series.unit)}
</span>
<span className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-500">
Max {formatMetricValue(high, series.metric, series.unit)}
</span>
</div>
</div>
<div className="rounded-2xl border border-slate-800/90 bg-slate-950/85 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
<svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[18rem] block text-slate-400">
<rect x={padX} y={padY} width={plotW} height={plotH} rx="14" fill="rgba(9,9,11,0.35)" />
{target && targetHighY !== null && targetLowY !== null && (
<rect
x={padX}
y={Math.min(targetHighY, targetLowY)}
width={plotW}
height={Math.max(1, Math.abs(targetLowY - targetHighY))}
fill="rgba(16,185,129,0.10)"
/>
)}
{yTicks.map(tick => (
<g key={tick.y}>
<line x1={padX} y1={tick.y} x2={width - padX} y2={tick.y} stroke="rgba(148,163,184,0.12)" />
<text x={14} y={tick.y + 4} fill="#94a3b8" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
{yLabel(tick.value)}
</text>
</g>
))}
{coords.length >= 2 && <path d={path} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className={series.color} />}
{coords.length >= 2 && <path d={path} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={series.color} />}
{coords.map(point => (
<g key={`${point.time.toISOString()}-${point.index}`}>
<circle cx={point.x} cy={point.y} r="4" className={series.color} fill="currentColor" stroke="rgba(9,9,11,0.95)" strokeWidth="1.5" />
<title>
{point.time.toLocaleString('en-IE')} · {formatMetricValue(point.value, series.metric, series.unit)}
</title>
</g>
))}
{xTicks.map(tick => (
<g key={tick.x}>
<line x1={tick.x} y1={padY + plotH} x2={tick.x} y2={padY + plotH + 7} stroke="#475569" />
<text x={tick.x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
{xLabel(tick.time)}
</text>
</g>
))}
{target && (
<g>
<text x={width - padX} y={Math.min(targetHighY ?? 0, targetLowY ?? 0) - 6} textAnchor="end" fill="#34d399" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
Target {formatMetricValue(target.low, series.metric, series.unit)}–{formatMetricValue(target.high, series.metric, series.unit)}
</text>
</g>
)}
</svg>
</div>
</div>
)
}
function StatusBadge({ value, metric }: { value: number | null; metric: MetricKey }) {
if (value === null) return <span className="text-slate-600 text-xs">—</span>
const status = getStatus(value, metric)
if (status === 'ok') return <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3 h-3" />{value.toFixed(metric === 'ph' ? 1 : 2)}</span>
if (status === 'warning') return <span className="inline-flex items-center gap-1 text-amber-400 text-xs"><AlertTriangle className="w-3 h-3" />{value.toFixed(metric === 'ph' ? 1 : 2)}</span>
return <span className="inline-flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3 h-3" />{value.toFixed(metric === 'ph' ? 1 : 2)}</span>
}
export default function ChemistryPage() {
const [readings, setReadings] = useState<Reading[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [viewMode, setViewMode] = useState<ViewMode>('day')
const [anchorDate, setAnchorDate] = useState(formatDateKey(new Date()))
const [anchorHour, setAnchorHour] = useState(new Date().getHours())
const [lastFetch, setLastFetch] = useState<string | null>(null)
const [selectedSeriesByPool, setSelectedSeriesByPool] = useState<Record<string, ReadingSeriesKey>>({})
const chartWindow = useMemo(() => buildChartWindow(viewMode, anchorDate, anchorHour), [viewMode, anchorDate, anchorHour])
const fetchRange = useMemo(() => buildFetchRange(viewMode, anchorDate), [viewMode, anchorDate])
const fetchData = useCallback(async () => {
  setLoading(true)
  setError(null)
  try {
    const res = await fetch(`/api/trail/chemistry?startDate=${fetchRange.startDate}&endDate=${fetchRange.endDate}`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const data = await res.json()

    const extracted: Reading[] = []
    if (data.recordLogs) {
      for (const [instanceId, logEntries] of Object.entries(data.recordLogs as Record<string, any[]>)) {
        const instance = data.instances?.find((i: { taskInstanceId: number }) => i.taskInstanceId === Number(instanceId))
        if (!instance) continue

        const name: string = instance.taskInstanceName || ''
        let poolLabel = 'Pool'
        const isStock = isCO2Stock(name)

        if (isStock) poolLabel = 'Chlorine & CO2'
        else if (/25m/i.test(name)) poolLabel = '25m Pool'
        else if (/18m/i.test(name)) poolLabel = '18m Pool'
        else if (/learner/i.test(name) || /child/i.test(name)) poolLabel = 'Learners Pool'
        else if (/test/i.test(name)) poolLabel = name.replace(/[🧪🛢️]/gu, '').trim()

        for (const log of logEntries) {
          const records = (log as any).records as Record<string, any>[] | undefined
          if (!records) continue

          extracted.push({
            time: instance.completedDatetime || instance.dueFromDatetime,
            siteId: instance.siteId,
            siteName: instance.siteName,
            poolLabel,
            freeChlorine: isStock ? null : getField(records, 'Free Chlorine'),
            totalChlorine: isStock ? null : getField(records, 'Total Chlorine'),
            combinedChlorine: isStock ? null : getField(records, 'Combined Chlorine'),
            ph: isStock ? null : getField(records, 'pH'),
            waterTemp: isStock ? null : getField(records, 'Water Temperature'),
            mpLpChlorine: isStock ? getField(records, 'MP & LP - Chlorine') : null,
            mpCo2: isStock ? getField(records, 'MP - CO2') : null,
            lpCo2: isStock ? getField(records, 'LP - CO2 ') : null,
            eighteenMChlorine: isStock ? getField(records, '18M - Chlorine') : null,
            eighteenMCo2: isStock ? getField(records, '18M - CO2') : null,
          })
        }
      }
    }

    extracted.sort((a, b) => b.time.localeCompare(a.time))
    setReadings(extracted)
    setLastFetch(data.fetchedAt)
  } catch (err) {
    setError(String(err))
  } finally {
    setLoading(false)
  }
}, [fetchRange.endDate, fetchRange.startDate])

useEffect(() => {
  fetchData()
}, [fetchData])

const visibleReadings = useMemo(
  () => filterReadings(readings, viewMode, anchorDate, anchorHour),
  [readings, viewMode, anchorDate, anchorHour],
)

const poolGroups = useMemo(() => {
  return visibleReadings.reduce<Record<string, Reading[]>>((acc, r) => {
    const key = `${r.siteName} — ${r.poolLabel}`
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})
}, [visibleReadings])

useEffect(() => {
  setSelectedSeriesByPool(prev => {
    let changed = false
    const next = { ...prev }

    for (const [poolName, poolReadings] of Object.entries(poolGroups)) {
      const latest = poolReadings[0]
      if (!latest) continue
      const options = getSeriesOptions(latest.poolLabel === 'Chlorine & CO2')
      if (!options.some(option => option.key === next[poolName])) {
        next[poolName] = options[0].key
        changed = true
      }
    }

    for (const existing of Object.keys(next)) {
      if (!poolGroups[existing]) {
        delete next[existing]
        changed = true
      }
    }

    return changed ? next : prev
  })
}, [poolGroups])

const getViewLabel = () => chartWindow.label

const handleModeChange = (mode: ViewMode) => {
  setViewMode(mode)
  if (mode === 'month') {
    const base = parseDateInput(anchorDate)
    setAnchorDate(`${formatMonthKey(base)}-01`)
  }
}

return (
  <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <FlaskConical className="w-6 h-6 text-emerald-400" />
          Pool Chemistry
        </h1>
        <p className="mt-1 text-slate-400">Live water quality readings from Trail</p>
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-2.5 shadow-[0_8px_24px_rgba(2,6,23,0.16)]">
          {(['hour', 'day', 'month'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`rounded-xl px-3 py-2 text-sm transition-colors ${viewMode === mode ? 'border border-emerald-500/30 bg-emerald-500/18 text-emerald-200' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}
            >
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}

          {viewMode === 'month' ? (
            <input
              type="month"
              value={anchorDate.slice(0, 7)}
              onChange={e => setAnchorDate(`${e.target.value}-01`)}
              className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-white shadow-inner shadow-black/20 focus:outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/40"
            />
          ) : (
            <input
              type="date"
              value={anchorDate}
              onChange={e => setAnchorDate(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-white shadow-inner shadow-black/20 focus:outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/40"
            />
          )}

          {viewMode === 'hour' && (
            <select
              value={anchorHour}
              onChange={e => setAnchorHour(Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-white shadow-inner shadow-black/20 focus:outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/40"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>
              ))}
            </select>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <p className="text-xs text-slate-500">Showing {getViewLabel()}</p>
      </div>
    </div>

    {error && (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
        Error loading data: {error}
      </div>
    )}

    {lastFetch && (
      <p className="text-xs text-slate-500">Last updated: {new Date(lastFetch).toLocaleString('en-IE')}</p>
    )}

    {loading && readings.length === 0 ? (
      <div className="py-12 text-center text-slate-400">Loading chemistry data...</div>
    ) : visibleReadings.length === 0 ? (
      <div className="py-12 text-center text-slate-400">No chemistry readings found for this filter</div>
    ) : (
      Object.entries(poolGroups).map(([poolName, poolReadings]) => {
        const latest = poolReadings[0]
        if (!latest) return null
        const isStock = latest.poolLabel === 'Chlorine & CO2'
        const seriesOptions = getSeriesOptions(isStock)
        const selectedSeries = seriesOptions.find(option => option.key === selectedSeriesByPool[poolName]) ?? seriesOptions[0]

        return (
          <div key={poolName} className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[linear-gradient(180deg,rgba(30,41,59,0.98),rgba(15,23,42,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="flex flex-col gap-3 border-b border-slate-700/80 bg-slate-950/50 px-4 py-4 md:px-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-50">{poolName}</h2>
                  <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300">
                    {isStock ? 'Stock feed' : 'Pool feed'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{poolReadings.length} readings in this filter</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {seriesOptions.map(option => (
                  <button
                    key={option.key}
                    onClick={() => setSelectedSeriesByPool(prev => ({ ...prev, [poolName]: option.key }))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${selectedSeries.key === option.key
                      ? 'border-emerald-500/30 bg-emerald-500/14 text-emerald-200'
                      : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${option.color}`} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {isStock ? (
              <div className="grid grid-cols-3 gap-px border-b border-slate-700/80 bg-slate-800/70">
                {([
                  ['MP & LP Cl₂', latest.mpLpChlorine],
                  ['18m Cl₂', latest.eighteenMChlorine],
                  ['MP CO₂', latest.mpCo2],
                ] as [string, number | null][]).map(([label, val]) => (
                  <div key={label} className="bg-slate-950/70 px-4 py-4 text-center">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
                    <p className="text-2xl font-semibold leading-none text-slate-50">{val !== null ? val.toFixed(2) : '—'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-px border-b border-slate-700/80 bg-slate-800/70 md:grid-cols-5">
                {(['freeChlorine', 'totalChlorine', 'combinedChlorine', 'ph', 'waterTemp'] as MetricKey[]).map(key => (
                  <div key={key} className="bg-slate-950/70 px-4 py-4 text-center">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">{THRESHOLDS[key].label}</p>
                    <div className="text-xl font-semibold">
                      <StatusBadge value={latest[key]} metric={key} />
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">{THRESHOLDS[key].unit}</p>
                  </div>
                ))}
              </div>
            )}

            <TimeSeriesChart
              readings={poolReadings.slice(0, 1000)}
              series={selectedSeries}
              title="Trend graph"
              mode={viewMode}
              window={chartWindow}
            />

            <div className="overflow-x-auto">
              {isStock ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/60 text-slate-400">
                      <th className="text-left px-4 py-2 font-medium">Time</th>
                      <th className="text-center px-2 py-2 font-medium">MP&LP Cl₂</th>
                      <th className="text-center px-2 py-2 font-medium">18m Cl₂</th>
                      <th className="text-center px-2 py-2 font-medium">MP CO₂</th>
                      <th className="text-center px-2 py-2 font-medium">LP CO₂</th>
                      <th className="text-center px-2 py-2 font-medium">18m CO₂</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolReadings.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b border-slate-700/30 hover:bg-white/[0.03]">
                        <td className="px-4 py-2 text-slate-300">{formatTime(r.time)}</td>
                        <td className="px-2 py-2 text-center text-slate-300">{r.mpLpChlorine !== null ? r.mpLpChlorine.toFixed(2) : '—'}</td>
                        <td className="px-2 py-2 text-center text-slate-300">{r.eighteenMChlorine !== null ? r.eighteenMChlorine.toFixed(2) : '—'}</td>
                        <td className="px-2 py-2 text-center text-slate-300">{r.mpCo2 !== null ? r.mpCo2.toFixed(2) : '—'}</td>
                        <td className="px-2 py-2 text-center text-slate-300">{r.lpCo2 !== null ? r.lpCo2.toFixed(2) : '—'}</td>
                        <td className="px-2 py-2 text-center text-slate-300">{r.eighteenMCo2 !== null ? r.eighteenMCo2.toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/60 text-slate-400">
                      <th className="text-left px-4 py-2 font-medium">Time</th>
                      <th className="text-center px-2 py-2 font-medium">Free Cl₂</th>
                      <th className="text-center px-2 py-2 font-medium">Total Cl₂</th>
                      <th className="text-center px-2 py-2 font-medium">Combined</th>
                      <th className="text-center px-2 py-2 font-medium">pH</th>
                      <th className="text-center px-2 py-2 font-medium">Temp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolReadings.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b border-slate-700/30 hover:bg-white/[0.03]">
                        <td className="px-4 py-2 text-slate-300">{formatTime(r.time)}</td>
                        <td className="px-2 py-2 text-center"><StatusBadge value={r.freeChlorine} metric="freeChlorine" /></td>
                        <td className="px-2 py-2 text-center"><StatusBadge value={r.totalChlorine} metric="totalChlorine" /></td>
                        <td className="px-2 py-2 text-center"><StatusBadge value={r.combinedChlorine} metric="combinedChlorine" /></td>
                        <td className="px-2 py-2 text-center"><StatusBadge value={r.ph} metric="ph" /></td>
                        <td className="px-2 py-2 text-center">
                          {r.waterTemp !== null
                            ? <span className="flex items-center justify-center gap-1 text-slate-300"><Thermometer className="w-3 h-3 text-slate-500" />{r.waterTemp.toFixed(1)}°C</span>
                            : <span className="text-slate-500">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      })
    )}
  </div>
)
}
