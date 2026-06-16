'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { SITES } from '@/lib/portal'
import type { TrailTaskInstance, TrailRecordLog } from '@/lib/trail/client'

// ── API shape ─────────────────────────────────────────────────────────────────

interface ChemApiData {
  instances?: TrailTaskInstance[]
  recordLogs?: Record<string, TrailRecordLog[]>
}

// ── Stock data types ──────────────────────────────────────────────────────────

interface StockReading {
  mpLpChlorine: number | null
  eighteenMChlorine: number | null
  time: string | null
}

// ── Tank capacities & thresholds ──────────────────────────────────────────────
// Values from Trail are in litres. Each tank has its own capacity, so status is
// based on the fill percentage rather than an absolute litre threshold.

const MP_LP_CAPACITY  = 500 // litres
const EIGHTEEN_M_CAPACITY = 250 // litres

const CRITICAL_PCT = 10
const WARNING_PCT  = 20 // reorder threshold

// How far back to pull readings — enough for ~6 months of usage history.
const HISTORY_DAYS = 180
const USAGE_MONTHS = 6
// Rolling window used to estimate the current consumption rate for forecasting.
const RATE_WINDOW_DAYS = 30

// Readings are eyeballed, so consecutive values jitter. A change of 20 L or less
// is treated as reading noise, not real consumption. An increase above 50 L is a
// tank refill, never a reading error. Both are excluded from usage totals.
const NOISE_FLOOR_L = 20
const REFILL_THRESHOLD_L = 50

type StockStatus = 'critical' | 'warning' | 'ok' | 'unknown'

function getStatus(value: number | null, capacity: number): StockStatus {
  if (value === null) return 'unknown'
  const pct = (value / capacity) * 100
  if (pct < CRITICAL_PCT) return 'critical'
  if (pct < WARNING_PCT)  return 'warning'
  return 'ok'
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function getField(records: TrailRecordLog['records'], fieldName: string): number | null {
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

function extractStockReading(data: ChemApiData, siteId: number): StockReading | null {
  if (!data.recordLogs || !data.instances) return null

  const candidates = data.instances
    .filter(i => i.siteId === siteId && isCO2Stock(i.taskInstanceName || ''))
    .sort((a, b) => {
      const ta = a.completedDatetime || a.dueFromDatetime || ''
      const tb = b.completedDatetime || b.dueFromDatetime || ''
      return tb.localeCompare(ta)
    })

  for (const inst of candidates) {
    const logs    = data.recordLogs[String(inst.taskInstanceId)] ?? []
    const records = logs.flatMap(l => l.records)
    const mpLp    = getField(records, 'MP & LP - Chlorine')
    const eightM  = getField(records, '18M - Chlorine')
    if (mpLp !== null || eightM !== null) {
      return {
        mpLpChlorine:      mpLp,
        eighteenMChlorine: eightM,
        time: inst.completedDatetime || inst.dueFromDatetime || null,
      }
    }
  }
  return null
}

// ── Time series, usage & forecasting ───────────────────────────────────────────

interface SeriesPoint {
  t: number      // epoch ms
  level: number  // litres in tank at that time
}

interface TankSeries {
  mpLp: SeriesPoint[]
  eighteenM: SeriesPoint[]
}

/** Builds an ascending-by-time level series for each tank from all stock readings. */
function extractSeries(data: ChemApiData, siteId: number): TankSeries {
  const mpLp: SeriesPoint[] = []
  const eighteenM: SeriesPoint[] = []
  if (!data.recordLogs || !data.instances) return { mpLp, eighteenM }

  for (const inst of data.instances) {
    if (inst.siteId !== siteId || !isCO2Stock(inst.taskInstanceName || '')) continue
    const iso = inst.completedDatetime || inst.dueFromDatetime
    if (!iso) continue
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) continue

    const logs    = data.recordLogs[String(inst.taskInstanceId)] ?? []
    const records = logs.flatMap(l => l.records)
    const mp  = getField(records, 'MP & LP - Chlorine')
    const m18 = getField(records, '18M - Chlorine')
    if (mp  !== null) mpLp.push({ t, level: mp })
    if (m18 !== null) eighteenM.push({ t, level: m18 })
  }

  mpLp.sort((a, b) => a.t - b.t)
  eighteenM.sort((a, b) => a.t - b.t)
  return { mpLp, eighteenM }
}

interface MonthUsage {
  key: string
  label: string
  litres: number       // total consumed this month
  leftoverUsed: number // of the total, the portion drawn from stock carried in
  refillUsed: number   // of the total, the portion drawn from this month's refills
  refilled: number     // litres added by refills during the month
}

/**
 * Litres consumed between two consecutive readings. Returns 0 for a refill
 * (a large increase) or for changes within the eyeballing noise band, so neither
 * inflates usage totals.
 */
function consumedBetween(prevLevel: number, curLevel: number): number {
  const delta = curLevel - prevLevel
  if (delta > REFILL_THRESHOLD_L) return 0 // refill, not consumption
  const drop = -delta                      // positive when the level fell
  if (drop <= NOISE_FLOOR_L) return 0      // within eyeballing noise (or a small rise)
  return drop
}

/** Litres added by a refill between two readings (0 if it isn't a refill). */
function refilledBetween(prevLevel: number, curLevel: number): number {
  const delta = curLevel - prevLevel
  return delta > REFILL_THRESHOLD_L ? delta : 0
}

/** Tank level at or just before `ms`, or null if no reading precedes it. */
function levelAtOrBefore(series: SeriesPoint[], ms: number): number | null {
  let level: number | null = null
  for (const p of series) {
    if (p.t <= ms) level = p.level
    else break
  }
  return level
}

/**
 * Spreads `litres` consumed over the interval [t0, t1] across the calendar months
 * it spans, in proportion to the time spent in each month. This keeps usage that
 * straddles a month boundary from being dumped entirely into the later month.
 */
function distributeAcrossMonths(
  t0: number,
  t1: number,
  litres: number,
  add: (year: number, month: number, litres: number) => void,
) {
  const span = t1 - t0
  if (span <= 0) {
    const d = new Date(t1)
    add(d.getFullYear(), d.getMonth(), litres)
    return
  }
  let cursor = t0
  while (cursor < t1) {
    const d = new Date(cursor)
    const nextMonthStart = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    const segEnd = Math.min(nextMonthStart, t1)
    add(d.getFullYear(), d.getMonth(), litres * ((segEnd - cursor) / span))
    cursor = segEnd
  }
}

/**
 * Per-month consumption, with each month's total split into the portion drawn
 * from stock carried in from the previous month and the portion drawn from
 * refills done within the month. Refills and reading noise are excluded from the
 * total, and cross-month consumption is split in proportion to elapsed time.
 *
 * The carried-in / refill split assumes carried-over stock is used before newly
 * refilled stock (FIFO): leftoverUsed = min(total, openingStock).
 */
function monthlyUsage(series: SeriesPoint[], monthsBack: number): MonthUsage[] {
  const now = new Date()
  const buckets: MonthUsage[] = []
  const index = new Map<string, number>()
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    index.set(key, buckets.length)
    buckets.push({
      key,
      label: d.toLocaleDateString('en-IE', { month: 'short' }),
      litres: 0,
      leftoverUsed: 0,
      refillUsed: 0,
      refilled: 0,
    })
  }

  for (let i = 1; i < series.length; i++) {
    // Consumption — split across the months the interval spans.
    const used = consumedBetween(series[i - 1].level, series[i].level)
    if (used > 0) {
      distributeAcrossMonths(series[i - 1].t, series[i].t, used, (year, month, litres) => {
        const bi = index.get(`${year}-${month}`)
        if (bi !== undefined) buckets[bi].litres += litres
      })
    }
    // Refills — attributed to the month the top-up happened in.
    const added = refilledBetween(series[i - 1].level, series[i].level)
    if (added > 0) {
      const d = new Date(series[i].t)
      const bi = index.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (bi !== undefined) buckets[bi].refilled += added
    }
  }

  // Split each month's total into carried-over vs this-month's-refill usage.
  for (const b of buckets) {
    const [y, m] = b.key.split('-').map(Number)
    const opening = levelAtOrBefore(series, new Date(y, m, 1).getTime()) ?? 0
    b.leftoverUsed = Math.min(b.litres, opening)
    b.refillUsed = Math.max(0, b.litres - b.leftoverUsed)
  }

  return buckets
}

/** Average litres consumed per day over the most recent window. */
function recentDailyRate(series: SeriesPoint[], windowDays: number): number | null {
  if (series.length < 2) return null
  const cutoff = Date.now() - windowDays * 86400000
  let pts = series.filter(p => p.t >= cutoff)
  if (pts.length < 2) pts = series // fall back to the full series

  let drop = 0
  for (let i = 1; i < pts.length; i++) {
    drop += consumedBetween(pts[i - 1].level, pts[i].level)
  }
  const spanDays = (pts[pts.length - 1].t - pts[0].t) / 86400000
  if (spanDays <= 0) return null
  const rate = drop / spanDays
  return rate > 0 ? rate : null
}

interface Forecast {
  current: number | null
  rate: number | null                 // litres/day
  reorder: 'now' | { date: Date; days: number } | null
}

function buildForecast(series: SeriesPoint[], capacity: number): Forecast {
  const current = series.length ? series[series.length - 1].level : null
  const rate = recentDailyRate(series, RATE_WINDOW_DAYS)
  const threshold = capacity * (WARNING_PCT / 100)

  let reorder: Forecast['reorder'] = null
  if (current !== null) {
    if (current <= threshold) {
      reorder = 'now'
    } else if (rate && rate > 0) {
      const days = (current - threshold) / rate
      reorder = { date: new Date(Date.now() + days * 86400000), days }
    }
  }
  return { current, rate, reorder }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function todayKey() {
  return new Date().toISOString().split('T')[0]
}
function daysAgoKey(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function formatStamp(iso: string | null): string | null {
  if (!iso) return null
  const d     = new Date(iso)
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth()    === today.getMonth()    &&
    d.getDate()     === today.getDate()
  const time = d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time
  return `${d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} · ${time}`
}

// ── UI components ─────────────────────────────────────────────────────────────

function StatusPill({ status, label }: { status: StockStatus; label: string }) {
  const cls =
    status === 'ok'       ? 'bg-emerald-500/15 text-emerald-300'
    : status === 'warning'  ? 'bg-amber-500/15 text-amber-300'
    : status === 'critical' ? 'bg-red-500/15 text-red-300'
    : 'bg-white/[0.08] text-white/60'

  const pulse =
    status === 'critical' ? 'pill-pulse-critical'
    : status === 'warning'  ? 'pill-pulse-warning'
    : ''

  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap ${cls} ${pulse}`}>
      {label}
    </span>
  )
}

function TankCard({
  label,
  description,
  value,
  capacity,
  readingTime,
}: {
  label: string
  description: string
  value: number | null
  capacity: number
  readingTime: string | null
}) {
  const status   = getStatus(value, capacity)
  const fillPct  = value !== null ? Math.min(100, (value / capacity) * 100) : 0

  const statusLabel =
    status === 'critical' ? 'Critical — Reorder now'
    : status === 'warning'  ? 'Low — Reorder soon'
    : status === 'ok'       ? 'Sufficient'
    : 'No data'

  const fillColor =
    status === 'critical' ? 'bg-red-500/70'
    : status === 'warning'  ? 'bg-amber-500/60'
    : status === 'ok'       ? 'bg-emerald-500/60'
    : 'bg-white/15'

  return (
    <article className="surface-card p-5">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-headline text-white">{label}</h3>
          <p className="mt-0.5 text-caption text-white/40">{description}</p>
        </div>
        <StatusPill status={status} label={statusLabel} />
      </div>

      <div className="mt-5 flex items-end gap-5">
        {/* Tank level gauge */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-12 h-32 rounded-xl overflow-hidden bg-white/[0.05] ring-1 ring-inset ring-white/10">
            {/* Fill */}
            <div
              className={`absolute bottom-0 left-0 right-0 transition-all duration-700 ${fillColor}`}
              style={{ height: `${fillPct}%` }}
            />
            {/* Tick marks */}
            {[75, 50, 25].map(pct => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-white/10"
                style={{ bottom: `${pct}%` }}
              />
            ))}
            {/* Percentage overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-semibold text-white/70 drop-shadow">
                {value !== null ? `${Math.round(fillPct)}%` : '—'}
              </span>
            </div>
          </div>
          <span className="text-caption text-white/30">of {capacity} L</span>
        </div>

        {/* Numeric value */}
        <div className="flex-1 min-w-0">
          <div className="font-mono leading-none text-white" style={{ fontSize: 'clamp(40px, 5vw, 60px)' }}>
            {value !== null ? Math.round(value) : '—'}
            {value !== null && (
              <span className="ml-2 text-2xl text-white/40">L</span>
            )}
          </div>
          <div className="mt-3 space-y-1 text-caption text-white/35">
            <div>Capacity {capacity} L · Critical below {CRITICAL_PCT}%</div>
            {readingTime
              ? <div>Last reading: {readingTime}</div>
              : <div>No reading found in the last 6 months</div>
            }
          </div>
        </div>
      </div>
    </article>
  )
}

function UsageBarChart({
  data,
  leftoverClass,
  refillClass,
}: {
  data: MonthUsage[]
  leftoverClass: string
  refillClass: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map(d => d.litres))
  if (max <= 0) {
    return (
      <div className="flex h-32 items-center justify-center text-caption text-white/30">
        No usage recorded yet
      </div>
    )
  }
  return (
    <div>
      {/* Legend */}
      <div className="mb-3 flex items-center gap-4 text-[11px] text-white/45">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block size-2.5 rounded-sm ${leftoverClass}`} />
          Carried over
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`inline-block size-2.5 rounded-sm ${refillClass}`} />
          This month&apos;s refill
        </span>
      </div>

      <div className="flex items-end gap-2" style={{ height: 128 }}>
        {data.map((d, i) => {
          const h = (d.litres / max) * 85 // leave headroom for the value label
          const leftoverPct = d.litres > 0 ? (d.leftoverUsed / d.litres) * 100 : 0
          const refillPct   = d.litres > 0 ? (d.refillUsed   / d.litres) * 100 : 0
          return (
            <div
              key={d.key}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(prev => (prev === i ? null : prev))}
            >
              {/* Tooltip */}
              {hover === i && d.litres > 0 && (
                <div className="surface-elevated pointer-events-none absolute bottom-full z-20 mb-1 w-40 rounded-lg p-2.5 text-left">
                  <div className="mb-1 text-caption font-medium text-white">{d.label}</div>
                  <div className="flex items-center justify-between text-[11px] text-white/55">
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block size-2 rounded-sm ${leftoverClass}`} />
                      Carried over
                    </span>
                    <span className="font-mono text-white/80">{Math.round(d.leftoverUsed)} L</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-white/55">
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block size-2 rounded-sm ${refillClass}`} />
                      This month&apos;s refill
                    </span>
                    <span className="font-mono text-white/80">{Math.round(d.refillUsed)} L</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between border-t border-white/[0.08] pt-1.5 text-[11px] text-white/55">
                    <span>Total used</span>
                    <span className="font-mono text-white">{Math.round(d.litres)} L</span>
                  </div>
                  {d.refilled > 0 && (
                    <div className="mt-1 flex items-center justify-between text-[11px] text-white/40">
                      <span>Refilled this month</span>
                      <span className="font-mono">{Math.round(d.refilled)} L</span>
                    </div>
                  )}
                </div>
              )}

              <span className="mb-1 font-mono text-[10px] text-white/45">
                {d.litres > 0 ? Math.round(d.litres) : ''}
              </span>
              <div
                className={`flex w-full flex-col justify-end overflow-hidden rounded-t-md transition-all duration-500 ${hover === i ? 'ring-1 ring-white/30' : ''}`}
                style={{ height: `${h}%` }}
              >
                <div className={refillClass}   style={{ height: `${refillPct}%` }} />
                <div className={leftoverClass} style={{ height: `${leftoverPct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map(d => (
          <div key={d.key} className="flex-1 text-center text-[10px] text-white/40">{d.label}</div>
        ))}
      </div>
    </div>
  )
}

function ForecastCard({
  label,
  series,
  capacity,
  leftoverClass,
  refillClass,
}: {
  label: string
  series: SeriesPoint[]
  capacity: number
  leftoverClass: string
  refillClass: string
}) {
  const usage = monthlyUsage(series, USAGE_MONTHS)
  const { rate, reorder } = buildForecast(series, capacity)

  const reorderNode =
    reorder === 'now'
      ? <span className="text-red-300">Reorder now</span>
      : reorder
      ? <span className={reorder.days <= 14 ? 'text-amber-300' : 'text-white'}>
          {formatDate(reorder.date)}
          <span className="text-white/40"> · in {Math.max(0, Math.round(reorder.days))}d</span>
        </span>
      : <span className="text-white/40">—</span>

  return (
    <article className="surface-card p-5">
      <div className="pb-4 border-b border-white/[0.06]">
        <h3 className="text-headline text-white">{label}</h3>
        <p className="mt-0.5 text-caption text-white/40">Monthly usage (litres) &amp; reorder forecast</p>
      </div>

      <div className="mt-4">
        <UsageBarChart data={usage} leftoverClass={leftoverClass} refillClass={refillClass} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.06]">
        <div>
          <div className="text-caption text-white/40">Avg daily use</div>
          <div className="mt-0.5 font-mono text-lg leading-none text-white">
            {rate !== null ? rate.toFixed(1) : '—'}
            <span className="ml-1 text-sm text-white/40">L/day</span>
          </div>
        </div>
        <div>
          <div className="text-caption text-white/40">Reorder by</div>
          <div className="mt-0.5 text-sm font-medium leading-tight">{reorderNode}</div>
        </div>
      </div>

      <p className="mt-3 text-caption text-white/30">
        Forecast projects the current usage rate down to the {WARNING_PCT}% reorder level and assumes no refills.
      </p>
    </article>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlantRoomPage() {
  const [stockReading, setStockReading] = useState<StockReading | null>(null)
  const [series,       setSeries]       = useState<TankSeries>({ mpLp: [], eighteenM: [] })
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [selectedSiteId, setSelectedSiteId] = useState<number>(SITES[0].id)

  const fetchData = useCallback(async (siteId: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/trail/chemistry?startDate=${daysAgoKey(HISTORY_DAYS)}&endDate=${todayKey()}`
      )
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json() as ChemApiData
      setStockReading(extractStockReading(data, siteId))
      setSeries(extractSeries(data, siteId))
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(selectedSiteId)
  }, [fetchData, selectedSiteId])

  const readingTime = stockReading ? formatStamp(stockReading.time) : null

  const site = SITES.find(s => s.id === selectedSiteId)
  const hasTwoTanks = (site?.pools as readonly string[] | undefined)?.includes('18m') ?? false

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-white/[0.06]">
        <div>
          <h1 className="text-title">Plant Room</h1>
          <p className="mt-1 text-callout text-white/50">Current chlorine stock levels from Trail.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="plant-site-select" className="sr-only">Site</label>
          <select
            id="plant-site-select"
            value={selectedSiteId}
            onChange={e => setSelectedSiteId(Number(e.target.value))}
            className="h-9 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            onClick={() => fetchData(selectedSiteId)}
            disabled={loading}
            aria-label="Refresh plant room data"
            className="flex items-center gap-2 h-9 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-white/60 hover:text-white disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
          {error}
        </div>
      )}

      {loading && !stockReading ? (
        <LoadingState label="Loading plant room data…" />
      ) : !stockReading ? (
        <div className="surface-card px-6 py-12 text-center text-[15px] text-white/40">
          No chlorine stock data found for this site in the last 7 days.
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${hasTwoTanks ? 'sm:grid-cols-2' : ''}`}>
          <TankCard
            label="MP & LP Tank"
            description="Main Pool + Learners Pool dosing"
            value={stockReading.mpLpChlorine}
            capacity={MP_LP_CAPACITY}
            readingTime={readingTime}
          />
          {hasTwoTanks && (
            <TankCard
              label="18M Tank"
              description="18 Metre Pool dosing"
              value={stockReading.eighteenMChlorine}
              capacity={EIGHTEEN_M_CAPACITY}
              readingTime={readingTime}
            />
          )}
        </div>
      )}

      {/* Usage & forecast */}
      {!loading && stockReading && (
        <div className="space-y-3">
          <h2 className="text-headline text-white/80">Usage &amp; forecast</h2>
          <div className={`grid grid-cols-1 gap-4 ${hasTwoTanks ? 'sm:grid-cols-2' : ''}`}>
            <ForecastCard
              label="MP & LP Tank"
              series={series.mpLp}
              capacity={MP_LP_CAPACITY}
              leftoverClass="bg-emerald-500/25"
              refillClass="bg-emerald-500/65"
            />
            {hasTwoTanks && (
              <ForecastCard
                label="18M Tank"
                series={series.eighteenM}
                capacity={EIGHTEEN_M_CAPACITY}
                leftoverClass="bg-sky-500/25"
                refillClass="bg-sky-500/65"
              />
            )}
          </div>
        </div>
      )}

    </div>
  )
}
