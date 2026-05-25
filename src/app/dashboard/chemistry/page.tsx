'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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

interface ThresholdConfig {
  low: number
  high: number
  idealLow?: number
  idealHigh?: number
  label: string
  unit: string
  displayMin: number
  displayMax: number
}

type MetricKey = 'freeChlorine' | 'totalChlorine' | 'combinedChlorine' | 'ph' | 'waterTemp' | 'waterTempLearners'

const THRESHOLDS: Record<MetricKey, ThresholdConfig> = {
  freeChlorine:      { low: 0.4, high: 2.5, idealLow: 0.8, idealHigh: 1.5, label: 'Free Cl₂',     unit: 'ppm', displayMin: 0,    displayMax: 3.5 },
  totalChlorine:     { low: 1.0, high: 4.0,                                 label: 'Total Cl₂',    unit: 'ppm', displayMin: 0,    displayMax: 5   },
  combinedChlorine:  { low: 0,   high: 1.0,                                 label: 'Combined Cl₂', unit: 'ppm', displayMin: 0,    displayMax: 1.5 },
  ph:                { low: 7.1, high: 7.7,                                 label: 'pH',            unit: '',    displayMin: 6.8,  displayMax: 8.0 },
  waterTemp:         { low: 27,  high: 29,  idealLow: 27,  idealHigh: 29,   label: 'Temp',          unit: '°C',  displayMin: 25,   displayMax: 31  },
  waterTempLearners: { low: 28,  high: 30,  idealLow: 28,  idealHigh: 30,   label: 'Temp',          unit: '°C',  displayMin: 26,   displayMax: 32  },
}

// ── Status logic ──────────────────────────────────────────────────────────────

type StatusLevel = 'ok' | 'warning' | 'critical' | 'unknown'

function getMetricStatus(value: number | null, key: MetricKey): StatusLevel {
  if (value === null) return 'unknown'
  const t = THRESHOLDS[key]
  if (value < t.low || value > t.high) return 'critical'
  if (t.idealLow !== undefined && t.idealHigh !== undefined) {
    if (value < t.idealLow || value > t.idealHigh) return 'warning'
    return 'ok'
  }
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

function formatReadingStamp(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  if (sameDay(d, new Date())) return time
  return `${d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} · ${time}`
}

function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }

// ── Trend helpers ─────────────────────────────────────────────────────────────

function computeTrend(readings: Reading[], metricKey: MetricKey): 'up' | 'down' | 'stable' | null {
  const field = (metricKey === 'waterTempLearners' ? 'waterTemp' : metricKey) as keyof Reading
  const values = readings.slice(0, 3).map(r => r[field] as number | null).filter((v): v is number => v !== null)
  if (values.length < 2) return null
  const current = values[0]
  const prevAvg = values.slice(1).reduce((s, v) => s + v, 0) / values.slice(1).length
  const threshold = (THRESHOLDS[metricKey].high - THRESHOLDS[metricKey].low) * 0.03
  if (current > prevAvg + threshold) return 'up'
  if (current < prevAvg - threshold) return 'down'
  return 'stable'
}

// ── Command-board UI components ───────────────────────────────────────────────

function StatusPill({ level, label }: { level: StatusLevel | 'live' | 'outdated' | 'aged'; label: string }) {
  const cls =
    level === 'ok' || level === 'live'
      ? 'text-green-400 border-green-600/40 bg-green-500/10'
      : level === 'warning' || level === 'outdated'
      ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
      : level === 'critical'
      ? 'text-red-400 border-red-600/40 bg-red-500/10'
      : level === 'aged'
      ? 'text-orange-400 border-orange-500/40 bg-orange-500/10'
      : 'text-slate-500 border-slate-700 bg-transparent'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 border text-[10px] font-mono tracking-widest uppercase whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

function RangeBar({ value, metricKey }: { value: number | null; metricKey: MetricKey }) {
  const t = THRESHOLDS[metricKey]
  const { low, high } = t
  const span = high - low
  // Fall back to 10%-from-boundary if no explicit ideal defined
  const idealLow  = t.idealLow  ?? low  + span * 0.1
  const idealHigh = t.idealHigh ?? high - span * 0.1

  // The bar always has 5 equal visual zones centred on ideal:
  //  0–20% red (critical low) · 20–40% yellow (watch low) ·
  //  40–60% green (ideal)     · 60–80% yellow (watch high) · 80–100% red (critical high)
  // The white marker position is normalised within each zone.
  const zoneW2 = idealLow - low          // warning-low numeric width
  const zoneW4 = high - idealHigh        // warning-high numeric width

  const valuePct = (() => {
    if (value === null) return null
    if (value < low) {
      const ref = zoneW2 > 0 ? zoneW2 : span * 0.1
      return Math.max(0, (1 - Math.min(1, (low - value) / ref)) * 10)
    }
    if (value < idealLow)   return 10 + ((value - low)       / zoneW2) * 20
    if (value <= idealHigh) return 30 + ((value - idealLow)  / (idealHigh - idealLow)) * 40
    if (value < high)       return 70 + ((value - idealHigh) / zoneW4) * 20
    const ref = zoneW4 > 0 ? zoneW4 : span * 0.1
    return Math.min(100, 90 + Math.min(1, (value - high) / ref) * 10)
  })()

  return (
    <div className="relative pt-2">
      {valuePct !== null && (
        <div
          className="absolute top-0"
          style={{
            left: `${valuePct}%`,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '5px solid rgba(255,255,255,0.8)',
          }}
        />
      )}
      <div className="h-2 relative overflow-hidden rounded-sm">
        <div className="absolute inset-y-0 left-[0%]  w-[10%] bg-red-500/40"    />
        <div className="absolute inset-y-0 left-[10%] w-[20%] bg-yellow-400/50" />
        <div className="absolute inset-y-0 left-[30%] w-[40%] bg-green-500/60"  />
        <div className="absolute inset-y-0 left-[70%] w-[20%] bg-yellow-400/50" />
        <div className="absolute inset-y-0 left-[90%] w-[10%] bg-red-500/40"    />
        {valuePct !== null && (
          <div
            className="absolute inset-y-0 w-0.5 bg-white/90"
            style={{ left: `${valuePct}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>
    </div>
  )
}

function MetricBlock({ metricKey, value, lastTime, recentReadings = [] }: { metricKey: MetricKey; value: number | null; lastTime: string | null; recentReadings?: Reading[] }) {
  const t = THRESHOLDS[metricKey]
  const status = getMetricStatus(value, metricKey)
  const statusLabel = getMetricStatusLabel(value, metricKey)
  const trend = computeTrend(recentReadings, metricKey)

  const displayValue =
    value === null ? '—'
    : metricKey === 'ph' ? value.toFixed(2)
    : (metricKey === 'waterTemp' || metricKey === 'waterTempLearners') ? value.toFixed(1)
    : value.toFixed(2)

  const targetBand =
    t.idealLow !== undefined && t.idealHigh !== undefined
      ? `Ideal ${t.idealLow}–${t.idealHigh} ${t.unit} · Acceptable ${t.low}–${t.high} ${t.unit}`
      : metricKey === 'ph'
      ? `Ideal 7.4 · Acceptable ${t.low.toFixed(1)}–${t.high.toFixed(1)}`
      : `Target ${t.low}–${t.high}${t.unit ? ` ${t.unit}` : ''}`

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
        <div className="flex items-center gap-1.5">
          {trend === 'up'     && <TrendingUp   className="w-3.5 h-3.5 text-slate-400" />}
          {trend === 'down'   && <TrendingDown className="w-3.5 h-3.5 text-slate-400" />}
          {trend === 'stable' && <Minus        className="w-3.5 h-3.5 text-slate-400" />}
          <StatusPill level={status} label={statusLabel} />
        </div>
      </div>
      <RangeBar value={value} metricKey={metricKey} />
      <div className="text-[10px] text-slate-500 font-mono">
        {targetBand}{lastTime ? ` · last test ${lastTime}` : ''}
      </div>
    </div>
  )
}

function PoolChemCard({ poolLabel, readings }: { poolLabel: string; readings: Reading[] }) {
  const reading = readings[0] ?? null
  const overall = getPoolOverallStatus(reading)
  const isStale = reading ? !sameDay(new Date(reading.time), new Date()) : false
  const overallLabel = { ok: 'Stable', warning: 'Watch', critical: 'Action needed', unknown: 'No data' }[overall]
  const lastTime = reading ? formatReadingStamp(reading.time) : null
  const ageMinutes = reading ? (Date.now() - new Date(reading.time).getTime()) / 60000 : null
  const isAged = ageMinutes !== null && ageMinutes > 135
  const tempKey: MetricKey = poolLabel === 'Learners Pool' ? 'waterTempLearners' : 'waterTemp'

  return (
    <article className="border border-white/[0.08] p-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <h3 className="font-mono text-sm uppercase tracking-[0.14em] text-white">{poolLabel}</h3>
        <div className="flex items-center gap-2">
          {isStale && <StatusPill level="outdated" label="Stale" />}
          {isAged && <StatusPill level="aged" label="Old data" />}
          <StatusPill level={overall} label={overallLabel} />
        </div>
      </div>
      <div className="mt-3 space-y-0">
        <MetricBlock metricKey="freeChlorine" value={reading?.freeChlorine ?? null} lastTime={lastTime} recentReadings={readings} />
        <MetricBlock metricKey="ph" value={reading?.ph ?? null} lastTime={lastTime} recentReadings={readings} />
        {reading?.waterTemp !== null && reading?.waterTemp !== undefined && (
          <MetricBlock metricKey={tempKey} value={reading.waterTemp} lastTime={lastTime} recentReadings={readings} />
        )}
      </div>
    </article>
  )
}

function BatherKpiCard({ poolLabel, count, completedAt }: { poolLabel: string; count: number | null; completedAt: Date | null }) {
  const ageMinutes = completedAt ? Math.floor((Date.now() - completedAt.getTime()) / 60000) : null
  const isOutdated = ageMinutes === null || ageMinutes > 45

  return (
    <article className="border border-white/[0.08] p-4">
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

  useEffect(() => { fetchLiveData() }, [fetchLiveData])

  // All readings per pool for the selected site (used for trend calculation)
  const readingsByPool = useMemo(() => {
    const map: Record<string, Reading[]> = {}
    for (const r of liveReadings) {
      if (r.siteId !== selectedSiteId) continue
      if (!map[r.poolLabel]) map[r.poolLabel] = []
      map[r.poolLabel].push(r)
    }
    return map
  }, [liveReadings, selectedSiteId])

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
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Pool Chemistry</div>
          {liveLoading && liveReadings.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 font-mono">Loading chemistry data…</div>
          ) : sitePoolLabels.filter(p => p !== 'Chlorine & CO2').length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No pools configured for this site.</div>
          ) : (
            <div className={`grid gap-3 ${sitePoolLabels.filter(p => p !== 'Chlorine & CO2').length === 3 ? 'grid-cols-3' : sitePoolLabels.filter(p => p !== 'Chlorine & CO2').length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {sitePoolLabels
                .filter(p => p !== 'Chlorine & CO2')
                .map(poolLabel => (
                  <PoolChemCard
                    key={poolLabel}
                    poolLabel={poolLabel}
                    readings={readingsByPool[poolLabel] ?? []}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
