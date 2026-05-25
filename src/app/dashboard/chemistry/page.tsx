'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { SITES } from '@/lib/portal'

// ── Data types ────────────────────────────────────────────────────────────────

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
  mpLpChlorine: number | null
  mpCo2: number | null
  lpCo2: number | null
  eighteenMChlorine: number | null
  eighteenMCo2: number | null
}

interface PoolBather {
  count: number | null
  completedAt: Date | null
}

type BathersByPool = Record<string, PoolBather>

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  freeChlorine:    { low: 0.5,  high: 3.0, label: 'Free Cl₂',      unit: 'ppm', displayMin: 0,   displayMax: 4   },
  totalChlorine:   { low: 1.0,  high: 4.0, label: 'Total Cl₂',     unit: 'ppm', displayMin: 0,   displayMax: 5   },
  combinedChlorine:{ low: 0,    high: 1.0, label: 'Combined Cl₂',  unit: 'ppm', displayMin: 0,   displayMax: 1.5 },
  ph:              { low: 7.2,  high: 7.8, label: 'pH',             unit: '',    displayMin: 7.0, displayMax: 8.0 },
  waterTemp:       { low: 26,   high: 32,  label: 'Temp',           unit: '°C',  displayMin: 20,  displayMax: 35  },
} as const

type MetricKey = keyof typeof THRESHOLDS

// ── Status logic ──────────────────────────────────────────────────────────────

type StatusLevel = 'ok' | 'warning' | 'critical' | 'unknown'

function getMetricStatus(value: number | null, key: MetricKey): StatusLevel {
  if (value === null) return 'unknown'
  const t = THRESHOLDS[key]
  if (value < t.low || value > t.high) return 'critical'
  const span = t.high - t.low
  if (value < t.low + span * 0.1 || value > t.high - span * 0.1) return 'warning'
  return 'ok'
}

function getMetricStatusLabel(value: number | null, key: MetricKey): string {
  if (value === null) return '—'
  const status = getMetricStatus(value, key)
  if (status === 'ok') return 'Ok'
  if (status === 'warning') return 'Watch'
  return value < THRESHOLDS[key].low ? 'Low' : 'High'
}

function getProgressPct(value: number | null, key: MetricKey): number {
  if (value === null) return 0
  const { displayMin, displayMax } = THRESHOLDS[key]
  return Math.max(0, Math.min(100, ((value - displayMin) / (displayMax - displayMin)) * 100))
}

function getPoolOverallStatus(reading: Reading | null): StatusLevel {
  if (!reading) return 'unknown'
  const statuses: StatusLevel[] = [
    getMetricStatus(reading.freeChlorine, 'freeChlorine'),
    getMetricStatus(reading.ph, 'ph'),
  ]
  if (statuses.some(s => s === 'critical')) return 'critical'
  if (statuses.some(s => s === 'warning')) return 'warning'
  if (statuses.every(s => s === 'ok')) return 'ok'
  return 'unknown'
}

// ── Bather loads parsing ──────────────────────────────────────────────────────

function poolLabelFromName(name: string): string | null {
  if (/25\s*m|main\s*pool/i.test(name)) return '25m Pool'
  if (/18\s*m/i.test(name)) return '18m Pool'
  if (/learn|lp\b|learner|teach/i.test(name)) return 'Learners Pool'
  return null
}

function getFirstNumericField(records: Record<string, any>[]): number | null {
  for (const rec of records) {
    for (const field of Object.values(rec)) {
      if (field?.value !== undefined && field.value !== null && field.value !== '') {
        const num = Number(field.value)
        if (!Number.isNaN(num) && num >= 0) return num
      }
    }
  }
  return null
}

function parseBatherLoads(instances: any[], recordLogs: Record<string, any[]>): BathersByPool {
  const result: BathersByPool = {
    '25m Pool':      { count: null, completedAt: null },
    '18m Pool':      { count: null, completedAt: null },
    'Learners Pool': { count: null, completedAt: null },
  }

  const completed = [...instances]
    .filter(i => i.completedDatetime)
    .sort((a, b) => b.completedDatetime.localeCompare(a.completedDatetime))

  for (const inst of completed) {
    const logs = recordLogs[String(inst.taskInstanceId)] ?? []
    const records = logs.flatMap((l: any) => l.records ?? [])
    const completedAt = new Date(inst.completedDatetime)

    // Try per-field extraction first: a single task can cover multiple pools
    // (e.g. "[BT] 25M & LP Bather Loads" has "25 Meters" and "Learners Pool" fields)
    let fieldMatched = false
    for (const rec of records) {
      for (const [fieldName, field] of Object.entries(rec as Record<string, any>)) {
        if (field?.value === undefined || field.value === null || field.value === '') continue
        const num = Number(field.value)
        if (Number.isNaN(num) || num < 0) continue
        const pool = poolLabelFromName(fieldName)
        if (pool && result[pool].completedAt === null) {
          result[pool] = { count: num, completedAt }
          fieldMatched = true
        }
      }
    }

    if (fieldMatched) continue

    // Fall back: match by task name and take the first numeric field
    const pool = poolLabelFromName(inst.taskInstanceName || '')
    if (pool && result[pool].completedAt === null) {
      result[pool] = { count: getFirstNumericField(records), completedAt }
    }
  }

  return result
}

// ── Chemistry data extraction ─────────────────────────────────────────────────

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

function extractReadings(data: any): Reading[] {
  const extracted: Reading[] = []
  if (!data.recordLogs) return extracted

  for (const [instanceId, logEntries] of Object.entries(data.recordLogs as Record<string, any[]>)) {
    const instance = data.instances?.find((i: any) => i.taskInstanceId === Number(instanceId))
    if (!instance) continue

    const name: string = instance.taskInstanceName || ''
    const isStock = isCO2Stock(name)
    let poolLabel = 'Pool'

    if (isStock) poolLabel = 'Chlorine & CO2'
    else if (/\b25\s*m/i.test(name)) poolLabel = '25m Pool'
    else if (/\b18\s*m/i.test(name)) poolLabel = '18m Pool'
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
        freeChlorine:     isStock ? null : getField(records, 'Free Chlorine'),
        totalChlorine:    isStock ? null : getField(records, 'Total Chlorine'),
        combinedChlorine: isStock ? null : getField(records, 'Combined Chlorine'),
        ph:               isStock ? null : getField(records, 'pH'),
        waterTemp:        isStock ? null : getField(records, 'Water Temperature'),
        mpLpChlorine:     isStock ? getField(records, 'MP & LP - Chlorine') : null,
        mpCo2:            isStock ? getField(records, 'MP - CO2') : null,
        lpCo2:            isStock ? getField(records, 'LP - CO2 ') : null,
        eighteenMChlorine:isStock ? getField(records, '18M - Chlorine') : null,
        eighteenMCo2:     isStock ? getField(records, '18M - CO2') : null,
      })
    }
  }

  return extracted.sort((a, b) => b.time.localeCompare(a.time))
}

// ── Site / pool helpers ───────────────────────────────────────────────────────

function poolLabelsForSite(siteId: number): string[] {
  const site = SITES.find(s => s.id === siteId)
  if (!site) return []
  return site.pools.map(p =>
    p === '25m' ? '25m Pool' : p === '18m' ? '18m Pool' : p === 'learners' ? 'Learners Pool' : `${p} Pool`
  )
}

// ── Date/time helpers ─────────────────────────────────────────────────────────

function todayDateKey() {
  return new Date().toISOString().split('T')[0]
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatTimeShort(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
}

function formatReadingStamp(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  if (sameDay(d, new Date())) return time
  return `${d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} · ${time}`
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function parseMonthInput(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0) }
function endOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999) }
function startOfHour(date: Date, hour: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0) }
function endOfHour(date: Date, hour: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 59, 59, 999) }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0) }
function endOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999) }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function sameMonth(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() }

function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }

function formatMetricValue(value: number, metric?: MetricKey, unit?: string) {
  if (metric === 'ph') return value.toFixed(1)
  if (metric === 'waterTemp') return `${value.toFixed(1)}${unit ?? '°C'}`
  return `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`
}

// ── Chart types / helpers ─────────────────────────────────────────────────────

type ViewMode = 'hour' | 'day' | 'month'

type SeriesOption = {
  key: keyof Reading & string
  label: string
  color: string
  metric?: MetricKey
  unit?: string
}

type TimeWindow = { start: Date; end: Date; label: string }

function buildChartWindow(mode: ViewMode, anchorDate: string, anchorHour: number): TimeWindow {
  const base = parseDateInput(anchorDate)
  if (mode === 'hour') {
    const start = startOfHour(base, anchorHour)
    const end = endOfHour(base, anchorHour)
    return {
      start, end,
      label: `${start.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })} · ${String(anchorHour).padStart(2, '0')}:00`,
    }
  }
  if (mode === 'month') {
    const monthDate = parseMonthInput(formatMonthKey(base))
    return { start: startOfMonth(monthDate), end: endOfMonth(monthDate), label: monthDate.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' }) }
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
    return { startDate: formatDateKey(startOfMonth(monthDate)), endDate: formatDateKey(endOfMonth(monthDate)) }
  }
  return { startDate: formatDateKey(startOfDay(base)), endDate: formatDateKey(endOfDay(base)) }
}

function filterReadings(readings: Reading[], mode: ViewMode, anchorDate: string, anchorHour: number) {
  const base = parseDateInput(anchorDate)
  const hourStart = startOfHour(base, anchorHour)
  const hourEnd = endOfHour(base, anchorHour)
  return readings.filter(r => {
    const d = new Date(r.time)
    if (mode === 'hour') return d >= hourStart && d <= hourEnd
    if (mode === 'month') return sameMonth(d, base)
    return sameDay(d, base)
  })
}

function getSeriesBounds(readings: Reading[], key: keyof Reading, metric?: MetricKey) {
  const values = readings
    .map(r => r[key as keyof Reading])
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

function getSeriesOptions(isStock: boolean): SeriesOption[] {
  return isStock
    ? [
        { key: 'mpLpChlorine',     label: 'MP & LP Cl₂', color: 'text-emerald-400' },
        { key: 'eighteenMChlorine',label: '18m Cl₂',     color: 'text-cyan-400' },
        { key: 'mpCo2',            label: 'MP CO₂',      color: 'text-amber-400' },
        { key: 'lpCo2',            label: 'LP CO₂',      color: 'text-purple-400' },
        { key: 'eighteenMCo2',     label: '18m CO₂',     color: 'text-rose-400' },
      ]
    : [
        { key: 'freeChlorine',     label: 'Free Cl₂',     color: 'text-emerald-400', metric: 'freeChlorine',     unit: 'ppm' },
        { key: 'totalChlorine',    label: 'Total Cl₂',    color: 'text-cyan-400',    metric: 'totalChlorine',    unit: 'ppm' },
        { key: 'combinedChlorine', label: 'Combined Cl₂', color: 'text-amber-400',   metric: 'combinedChlorine', unit: 'ppm' },
        { key: 'ph',               label: 'pH',            color: 'text-purple-400',  metric: 'ph' },
        { key: 'waterTemp',        label: 'Temp',          color: 'text-rose-400',    metric: 'waterTemp',        unit: '°C' },
      ]
}

// ── Chart component ───────────────────────────────────────────────────────────

function TimeSeriesChart({ readings, series, title, mode, window }: {
  readings: Reading[]
  series: SeriesOption
  title: string
  mode: ViewMode
  window: TimeWindow
}) {
  const points = [...readings].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  const numericValues = points.map(r => r[series.key as keyof Reading]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  if (points.length === 0 || numericValues.length === 0) {
    return (
      <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-950/30">
        <div className="text-sm text-slate-500 py-10 text-center border border-dashed border-slate-800 rounded-xl">
          No readings in this time window
        </div>
      </div>
    )
  }

  const width = 720; const height = 280; const padX = 56; const padY = 22
  const plotW = width - padX * 2; const plotH = height - padY * 2
  const bounds = getSeriesBounds(points, series.key as keyof Reading, series.metric)
  const range = Math.max(1, window.end.getTime() - window.start.getTime())
  const minValue = bounds.min; const maxValue = bounds.max; const span = maxValue - minValue || 1

  const coords = points.map((point, index) => {
    const value = point[series.key as keyof Reading]
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    const time = new Date(point.time)
    if (Number.isNaN(time.getTime())) return null
    const x = padX + clamp01((time.getTime() - window.start.getTime()) / range) * plotW
    const yNorm = clamp01((value - minValue) / span)
    const y = padY + plotH - yNorm * plotH
    return { x, y, time, value, index }
  }).filter((p): p is NonNullable<typeof p> => p !== null)

  const path = coords.length >= 2 ? coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : ''
  const yTicks = Array.from({ length: 5 }, (_, i) => ({ value: maxValue - span * (i / 4), y: padY + plotH * (i / 4) }))
  const xTicks = Array.from({ length: 5 }, (_, i) => ({ time: new Date(window.start.getTime() + range * (i / 4)), x: padX + plotW * (i / 4) }))

  const target = series.metric ? THRESHOLDS[series.metric] : null
  const targetLowY = target ? padY + plotH - clamp01((target.low - minValue) / span) * plotH : null
  const targetHighY = target ? padY + plotH - clamp01((target.high - minValue) / span) * plotH : null

  const latest = points[points.length - 1]
  const low = Math.min(...numericValues)
  const high = Math.max(...numericValues)
  const avg = numericValues.reduce((s, v) => s + v, 0) / numericValues.length
  const latestStatus = series.metric ? getMetricStatus(latest[series.key as keyof Reading] as number | null, series.metric) : 'ok'
  const latestStatusLabel = latestStatus === 'critical' ? 'Out of range' : latestStatus === 'warning' ? 'Watch' : 'In range'

  const xLabel = (time: Date) => {
    if (mode === 'month') return time.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
    return time.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  }
  const yLabel = (v: number) => formatMetricValue(v, series.metric, series.unit)
  const latestVal = latest[series.key as keyof Reading]
  const latestDisplay = typeof latestVal === 'number' ? formatMetricValue(latestVal, series.metric, series.unit) : '—'

  return (
    <div className="px-4 md:px-5 py-4 border-b border-slate-800/60 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,rgba(9,9,11,0.95),rgba(24,24,27,0.92))]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between mb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-300">
              <span className={`w-2 h-2 rounded-full ${series.color}`} />Live trend
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-slate-400">{window.label}</span>
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
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${latestStatus === 'critical' ? 'border-red-500/20 bg-red-500/10 text-red-300' : latestStatus === 'warning' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${series.color}`} />{latestDisplay}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-500">Avg {formatMetricValue(avg, series.metric, series.unit)}</span>
          <span className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-500">Min {formatMetricValue(low, series.metric, series.unit)}</span>
          <span className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-500">Max {formatMetricValue(high, series.metric, series.unit)}</span>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800/90 bg-slate-950/85 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[18rem] block text-slate-400">
          <rect x={padX} y={padY} width={plotW} height={plotH} rx="14" fill="rgba(9,9,11,0.35)" />
          {target && targetHighY !== null && targetLowY !== null && (
            <rect x={padX} y={Math.min(targetHighY, targetLowY)} width={plotW} height={Math.max(1, Math.abs(targetLowY - targetHighY))} fill="rgba(16,185,129,0.10)" />
          )}
          {yTicks.map(tick => (
            <g key={tick.y}>
              <line x1={padX} y1={tick.y} x2={width - padX} y2={tick.y} stroke="rgba(148,163,184,0.12)" />
              <text x={14} y={tick.y + 4} fill="#94a3b8" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{yLabel(tick.value)}</text>
            </g>
          ))}
          {coords.length >= 2 && <path d={path} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className={series.color} />}
          {coords.map(point => (
            <g key={`${point.time.toISOString()}-${point.index}`}>
              <circle cx={point.x} cy={point.y} r="4" className={series.color} fill="currentColor" stroke="rgba(9,9,11,0.95)" strokeWidth="1.5" />
              <title>{point.time.toLocaleString('en-IE')} · {formatMetricValue(point.value, series.metric, series.unit)}</title>
            </g>
          ))}
          {xTicks.map(tick => (
            <g key={tick.x}>
              <line x1={tick.x} y1={padY + plotH} x2={tick.x} y2={padY + plotH + 7} stroke="#475569" />
              <text x={tick.x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{xLabel(tick.time)}</text>
            </g>
          ))}
          {target && (
            <text x={width - padX} y={Math.min(targetHighY ?? 0, targetLowY ?? 0) - 6} textAnchor="end" fill="#34d399" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
              Target {formatMetricValue(target.low, series.metric, series.unit)}–{formatMetricValue(target.high, series.metric, series.unit)}
            </text>
          )}
        </svg>
      </div>
    </div>
  )
}

// ── Command-board UI components ───────────────────────────────────────────────

function StatusPill({ level, label }: { level: StatusLevel | 'live' | 'outdated'; label: string }) {
  const cls =
    level === 'ok' || level === 'live'
      ? 'text-green-400 border-green-600/40 bg-green-500/10'
      : level === 'warning' || level === 'outdated'
      ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
      : level === 'critical'
      ? 'text-red-400 border-red-600/40 bg-red-500/10'
      : 'text-slate-500 border-slate-700 bg-transparent'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 border text-[10px] font-mono tracking-widest uppercase whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

function ProgressBar({ pct, level }: { pct: number; level: StatusLevel }) {
  const fill =
    level === 'ok'       ? 'bg-green-500'  :
    level === 'warning'  ? 'bg-yellow-400' :
    level === 'critical' ? 'bg-red-500'    : 'bg-slate-600'
  return (
    <div className="h-2 bg-white/[0.08] relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function MetricBlock({ metricKey, value, lastTime }: { metricKey: MetricKey; value: number | null; lastTime: string | null }) {
  const t = THRESHOLDS[metricKey]
  const status = getMetricStatus(value, metricKey)
  const pct = getProgressPct(value, metricKey)
  const statusLabel = getMetricStatusLabel(value, metricKey)

  const displayValue =
    value === null      ? '—'
    : metricKey === 'ph'       ? value.toFixed(2)
    : metricKey === 'waterTemp'? value.toFixed(1)
    : value.toFixed(2)

  const targetBand =
    metricKey === 'ph'
      ? `Target ${t.low.toFixed(1)}–${t.high.toFixed(1)}`
      : `Target ${t.low}–${t.high} ${t.unit}`

  return (
    <div className="space-y-2 pt-3 border-t border-white/[0.06] first:pt-0 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-1">{t.label}</div>
          <div className="font-mono leading-none text-white text-4xl">
            {displayValue}
            {value !== null && t.unit && <span className="text-xl text-slate-400 ml-1">{t.unit}</span>}
          </div>
        </div>
        <StatusPill level={status} label={statusLabel} />
      </div>
      <ProgressBar pct={pct} level={status} />
      <div className="text-[10px] text-slate-500 font-mono">
        {targetBand}{lastTime ? ` · last test ${lastTime}` : ''}
      </div>
    </div>
  )
}

function PoolChemCard({ poolLabel, reading }: { poolLabel: string; reading: Reading | null }) {
  const overall = getPoolOverallStatus(reading)
  const isStale = reading ? !sameDay(new Date(reading.time), new Date()) : false
  const overallLabel = { ok: 'Stable', warning: 'Watch', critical: 'Action needed', unknown: 'No data' }[overall]
  const lastTime = reading ? formatReadingStamp(reading.time) : null

  return (
    <article className="border border-white/[0.08] p-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <h3 className="font-mono text-sm uppercase tracking-[0.14em] text-white">{poolLabel}</h3>
        <div className="flex items-center gap-2">
          {isStale && <StatusPill level="outdated" label="Stale" />}
          <StatusPill level={overall} label={overallLabel} />
        </div>
      </div>
      <div className="mt-3 space-y-0">
        <MetricBlock metricKey="freeChlorine" value={reading?.freeChlorine ?? null} lastTime={lastTime} />
        <MetricBlock metricKey="ph" value={reading?.ph ?? null} lastTime={lastTime} />
        {reading?.waterTemp !== null && reading?.waterTemp !== undefined && (
          <MetricBlock metricKey="waterTemp" value={reading.waterTemp} lastTime={lastTime} />
        )}
      </div>
    </article>
  )
}

function BatherKpiCard({ poolLabel, count, completedAt }: { poolLabel: string; count: number | null; completedAt: Date | null }) {
  const ageMinutes = completedAt ? Math.floor((Date.now() - completedAt.getTime()) / 60000) : null
  const isOutdated = ageMinutes === null || ageMinutes > 20

  return (
    <article className="border border-white/10 p-4 bg-white/[0.015]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400 leading-snug">
          {poolLabel}<br />swimmers now
        </span>
        <StatusPill level={isOutdated ? 'outdated' : 'live'} label={isOutdated ? 'Outdated' : 'Live'} />
      </div>
      <div className="font-mono leading-none text-white mb-3" style={{ fontSize: 'clamp(32px, 3vw, 48px)' }}>
        {count !== null ? count.toLocaleString() : '—'}
      </div>
      <div className="text-[10px] font-mono text-slate-500">
        {completedAt
          ? ageMinutes === 0
            ? 'Just updated'
            : `Updated ${ageMinutes}m ago · ${completedAt.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`
          : 'No bather count today'}
      </div>
    </article>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChemistryPage() {
  // Live command data (always today)
  const [liveReadings, setLiveReadings] = useState<Reading[]>([])
  const [batherData, setBatherData] = useState<BathersByPool>({})
  const [liveLoading, setLiveLoading] = useState(true)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [liveLastFetch, setLiveLastFetch] = useState<string | null>(null)

  // Site selection
  const [selectedSiteId, setSelectedSiteId] = useState<number>(SITES[0].id)

  // Historical trend data
  const [readings, setReadings] = useState<Reading[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [anchorDate, setAnchorDate] = useState(todayDateKey())
  const [anchorHour, setAnchorHour] = useState(new Date().getHours())
  const [trendLastFetch, setTrendLastFetch] = useState<string | null>(null)
  const [selectedSeriesByPool, setSelectedSeriesByPool] = useState<Record<string, string>>({})

  const chartWindow = useMemo(() => buildChartWindow(viewMode, anchorDate, anchorHour), [viewMode, anchorDate, anchorHour])
  const fetchRange = useMemo(() => buildFetchRange(viewMode, anchorDate), [viewMode, anchorDate])

  // Fetch live command data (last 7 days so pools always show the most recent reading)
  const fetchLiveData = useCallback(async () => {
    setLiveLoading(true)
    setLiveError(null)
    try {
      const today = todayDateKey()
      const sevenDaysAgo = formatDateKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      const [chemRes, batherRes] = await Promise.all([
        fetch(`/api/trail/chemistry?startDate=${sevenDaysAgo}&endDate=${today}`),
        fetch('/api/trail/bather-loads'),
      ])
      if (!chemRes.ok) throw new Error(`Chemistry API error: ${chemRes.status}`)
      if (!batherRes.ok) throw new Error(`Bather loads API error: ${batherRes.status}`)

      const chemData = await chemRes.json()
      const batherRaw = await batherRes.json()

      setLiveReadings(extractReadings(chemData))
      setBatherData(parseBatherLoads(batherRaw.instances ?? [], batherRaw.recordLogs ?? {}))
      setLiveLastFetch(chemData.fetchedAt)
    } catch (err) {
      setLiveError(String(err))
    } finally {
      setLiveLoading(false)
    }
  }, [])

  // Fetch historical trend data
  const fetchTrendData = useCallback(async () => {
    setTrendLoading(true)
    setTrendError(null)
    try {
      const res = await fetch(`/api/trail/chemistry?startDate=${fetchRange.startDate}&endDate=${fetchRange.endDate}`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setReadings(extractReadings(data))
      setTrendLastFetch(data.fetchedAt)
    } catch (err) {
      setTrendError(String(err))
    } finally {
      setTrendLoading(false)
    }
  }, [fetchRange.startDate, fetchRange.endDate])

  useEffect(() => { fetchLiveData() }, [fetchLiveData])
  useEffect(() => { fetchTrendData() }, [fetchTrendData])

  // Latest reading per pool for the selected site (command section)
  const latestByPool = useMemo(() => {
    const map: Record<string, Reading> = {}
    for (const r of liveReadings) {
      if (r.siteId !== selectedSiteId) continue
      if (!map[r.poolLabel]) map[r.poolLabel] = r
    }
    return map
  }, [liveReadings, selectedSiteId])

  // Trend section pools
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
        if (!options.some(o => o.key === next[poolName])) { next[poolName] = options[0].key; changed = true }
      }
      for (const existing of Object.keys(next)) {
        if (!poolGroups[existing]) { delete next[existing]; changed = true }
      }
      return changed ? next : prev
    })
  }, [poolGroups])

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'month') setAnchorDate(`${formatMonthKey(parseDateInput(anchorDate))}-01`)
  }

  const sitePoolLabels = poolLabelsForSite(selectedSiteId)

  return (
    <div className="space-y-8">

      {/* ── Live command section ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-white/10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Operations console</div>
            <h1 className="text-3xl font-light text-white leading-tight">Pool chemistry command</h1>
            <p className="mt-1 text-sm text-slate-400">Live water quality and bather load data from Trail.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(Number(e.target.value))}
              className="border border-white/10 bg-slate-900/80 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/20"
            >
              {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button
              onClick={fetchLiveData}
              disabled={liveLoading}
              className="flex items-center gap-2 border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 hover:border-white/20 hover:text-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${liveLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {liveError && (
          <div className="border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300 font-mono">{liveError}</div>
        )}

        {/* Bather load KPI strip */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Bather loads</div>
          <div className={`grid gap-3 ${sitePoolLabels.length === 3 ? 'grid-cols-3' : sitePoolLabels.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {sitePoolLabels.map(poolLabel => (
              <BatherKpiCard
                key={poolLabel}
                poolLabel={poolLabel}
                count={batherData[poolLabel]?.count ?? null}
                completedAt={batherData[poolLabel]?.completedAt ?? null}
              />
            ))}
          </div>
        </div>

        {/* Chemistry command panel */}
        <div className="border border-white/10">
          <div className="flex items-start justify-between gap-4 p-4 pb-3 border-b border-white/[0.06]">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Priority module</div>
              <h2 className="text-xl font-light text-white">Pool chemistry</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Track free chlorine and pH across the pools before the next session.
                {liveLastFetch && <span className="ml-2 text-slate-600">Updated {new Date(liveLastFetch).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}</span>}
              </p>
            </div>
          </div>

          {liveLoading && liveReadings.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 font-mono">Loading chemistry data…</div>
          ) : sitePoolLabels.filter(p => p !== 'Chlorine & CO2').length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No pools configured for this site.</div>
          ) : (
            <div className={`grid gap-px bg-white/[0.06] ${sitePoolLabels.filter(p => p !== 'Chlorine & CO2').length === 3 ? 'grid-cols-3' : sitePoolLabels.filter(p => p !== 'Chlorine & CO2').length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {sitePoolLabels
                .filter(p => p !== 'Chlorine & CO2')
                .map(poolLabel => (
                  <PoolChemCard
                    key={poolLabel}
                    poolLabel={poolLabel}
                    reading={latestByPool[poolLabel] ?? null}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Trend analysis section ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between pt-2 border-t border-white/10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Historical data</div>
            <h2 className="text-xl font-light text-white">Trend analysis</h2>
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
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              )}
              <button
                onClick={fetchTrendData}
                disabled={trendLoading}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${trendLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <p className="text-xs text-slate-500">{chartWindow.label}</p>
          </div>
        </div>

        {trendError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{trendError}</div>
        )}
        {trendLastFetch && (
          <p className="text-xs text-slate-500">Data as of {new Date(trendLastFetch).toLocaleString('en-IE')}</p>
        )}

        {trendLoading && readings.length === 0 ? (
          <div className="py-12 text-center text-slate-400">Loading trend data…</div>
        ) : visibleReadings.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No readings found for this period.</div>
        ) : (
          Object.entries(poolGroups).map(([poolName, poolReadings]) => {
            const latest = poolReadings[0]
            if (!latest) return null
            const isStock = latest.poolLabel === 'Chlorine & CO2'
            const seriesOptions = getSeriesOptions(isStock)
            const selectedKey = selectedSeriesByPool[poolName] ?? seriesOptions[0].key
            const selectedSeries = seriesOptions.find(o => o.key === selectedKey) ?? seriesOptions[0]

            return (
              <div key={poolName} className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[linear-gradient(180deg,rgba(30,41,59,0.98),rgba(15,23,42,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                <div className="flex flex-col gap-3 border-b border-slate-700/80 bg-slate-950/50 px-4 py-4 md:px-5 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-50">{poolName}</h3>
                      <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300">
                        {isStock ? 'Stock feed' : 'Pool feed'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{poolReadings.length} readings in this period</p>
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
                    {([['MP & LP Cl₂', latest.mpLpChlorine], ['18m Cl₂', latest.eighteenMChlorine], ['MP CO₂', latest.mpCo2]] as [string, number | null][]).map(([label, val]) => (
                      <div key={label} className="bg-slate-950/70 px-4 py-4 text-center">
                        <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
                        <p className="text-2xl font-semibold leading-none text-slate-50">{val !== null ? val.toFixed(2) : '—'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-px border-b border-slate-700/80 bg-slate-800/70 md:grid-cols-5">
                    {(['freeChlorine', 'totalChlorine', 'combinedChlorine', 'ph', 'waterTemp'] as MetricKey[]).map(key => {
                      const val = latest[key as keyof Reading] as number | null
                      const status = getMetricStatus(val, key)
                      const statusColor = status === 'ok' ? 'text-emerald-400' : status === 'warning' ? 'text-amber-400' : status === 'critical' ? 'text-red-400' : 'text-slate-500'
                      return (
                        <div key={key} className="bg-slate-950/70 px-4 py-4 text-center">
                          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">{THRESHOLDS[key].label}</p>
                          <p className={`text-xl font-semibold ${statusColor}`}>
                            {val !== null ? (key === 'ph' ? val.toFixed(1) : key === 'waterTemp' ? `${val.toFixed(1)}°C` : val.toFixed(2)) : '—'}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">{THRESHOLDS[key].unit}</p>
                        </div>
                      )
                    })}
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
                            <td className="px-4 py-2 text-slate-300">{formatTimeShort(r.time)}</td>
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
                        {poolReadings.slice(0, 10).map((r, i) => {
                          const rowStatus = (v: number | null, k: MetricKey) => {
                            const s = getMetricStatus(v, k)
                            return s === 'ok' ? 'text-slate-300' : s === 'warning' ? 'text-amber-400' : s === 'critical' ? 'text-red-400' : 'text-slate-500'
                          }
                          return (
                            <tr key={i} className="border-b border-slate-700/30 hover:bg-white/[0.03]">
                              <td className="px-4 py-2 text-slate-300">{formatTimeShort(r.time)}</td>
                              <td className={`px-2 py-2 text-center ${rowStatus(r.freeChlorine, 'freeChlorine')}`}>{r.freeChlorine !== null ? r.freeChlorine.toFixed(2) : '—'}</td>
                              <td className={`px-2 py-2 text-center ${rowStatus(r.totalChlorine, 'totalChlorine')}`}>{r.totalChlorine !== null ? r.totalChlorine.toFixed(2) : '—'}</td>
                              <td className={`px-2 py-2 text-center ${rowStatus(r.combinedChlorine, 'combinedChlorine')}`}>{r.combinedChlorine !== null ? r.combinedChlorine.toFixed(2) : '—'}</td>
                              <td className={`px-2 py-2 text-center ${rowStatus(r.ph, 'ph')}`}>{r.ph !== null ? r.ph.toFixed(1) : '—'}</td>
                              <td className="px-2 py-2 text-center text-slate-300">{r.waterTemp !== null ? `${r.waterTemp.toFixed(1)}°C` : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
