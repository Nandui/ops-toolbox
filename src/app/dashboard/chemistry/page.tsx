'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { fetchWithTimeout, loadErrorMessage } from '@/lib/fetch'
import { SITES } from '@/lib/portal'
import type { TrailTaskInstance, TrailRecordLog } from '@/lib/trail/client'

// ── API response shape ────────────────────────────────────────────────────────

interface ChemApiData {
  instances?: TrailTaskInstance[]
  recordLogs?: Record<string, TrailRecordLog[]>
  fetchedAt?: string
}

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

function getFirstNumericField(records: TrailRecordLog['records']): number | null {
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

function parseBatherLoads(instances: TrailTaskInstance[], recordLogs: Record<string, TrailRecordLog[]>): BathersByPool {
  const result: BathersByPool = {
    '25m Pool':      { count: null, completedAt: null },
    '18m Pool':      { count: null, completedAt: null },
    'Learners Pool': { count: null, completedAt: null },
  }

  const completed = [...instances]
    .filter(i => i.completedDatetime)
    .sort((a, b) => b.completedDatetime!.localeCompare(a.completedDatetime!))

  for (const inst of completed) {
    const logs = recordLogs[String(inst.taskInstanceId)] ?? []
    const records = logs.flatMap(l => l.records)
    const completedAt = new Date(inst.completedDatetime!)

    // Try per-field extraction first: a single task can cover multiple pools
    // (e.g. "[BT] 25M & LP Bather Loads" has "25 Meters" and "Learners Pool" fields)
    let fieldMatched = false
    for (const rec of records) {
      for (const [fieldName, field] of Object.entries(rec)) {
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

function extractReadings(data: ChemApiData): Reading[] {
  const extracted: Reading[] = []
  if (!data.recordLogs) return extracted

  for (const [instanceId, logEntries] of Object.entries(data.recordLogs)) {
    const instance = data.instances?.find(i => i.taskInstanceId === Number(instanceId))
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
      const { records } = log

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
      ? 'pill-ok'
      : level === 'warning' || level === 'outdated' || level === 'aged'
      ? 'pill-warning'
      : level === 'critical'
      ? 'pill-critical'
      : 'pill-neutral'

  return (
    <span className={`pill-base ${cls}`}>
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
            borderTop: '5px solid var(--foreground)',
          }}
        />
      )}
      <div className="h-2 relative overflow-hidden rounded-sm">
        <div className="absolute inset-y-0 left-[0%]  w-[10%]" style={{ background: 'color-mix(in oklch, var(--destructive) 40%, transparent)' }} />
        <div className="absolute inset-y-0 left-[10%] w-[20%]" style={{ background: 'color-mix(in oklch, var(--warning) 50%, transparent)' }} />
        <div className="absolute inset-y-0 left-[30%] w-[40%]" style={{ background: 'color-mix(in oklch, var(--success) 60%, transparent)' }} />
        <div className="absolute inset-y-0 left-[70%] w-[20%]" style={{ background: 'color-mix(in oklch, var(--warning) 50%, transparent)' }} />
        <div className="absolute inset-y-0 left-[90%] w-[10%]" style={{ background: 'color-mix(in oklch, var(--destructive) 40%, transparent)' }} />
        {valuePct !== null && (
          <div
            className="absolute inset-y-0 w-0.5"
            style={{ left: `${valuePct}%`, transform: 'translateX(-50%)', background: 'var(--foreground)' }}
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
    <div className="space-y-2 pt-3 border-t border-border first:pt-0 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="mb-1 text-caption text-muted-foreground">{t.label}</div>
          <div className="font-mono text-4xl leading-none text-foreground">
            {displayValue}
            {value !== null && t.unit && <span className="ml-1 text-xl text-muted-foreground">{t.unit}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {trend === 'up'     && <TrendingUp   className="size-3.5 text-muted-foreground" />}
          {trend === 'down'   && <TrendingDown className="size-3.5 text-muted-foreground" />}
          {trend === 'stable' && <Minus        className="size-3.5 text-muted-foreground" />}
          <StatusPill level={status} label={statusLabel} />
        </div>
      </div>
      <RangeBar value={value} metricKey={metricKey} />
      <div className="text-caption text-muted-foreground/70">
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
  // eslint-disable-next-line react-hooks/purity
  const ageMinutes = reading ? (Date.now() - new Date(reading.time).getTime()) / 60000 : null
  const isAged = ageMinutes !== null && ageMinutes > 135
  const tempKey: MetricKey = poolLabel === 'Learners Pool' ? 'waterTempLearners' : 'waterTemp'

  return (
    <article className="surface-card p-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
        <h3 className="text-headline text-foreground">{poolLabel}</h3>
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
  // eslint-disable-next-line react-hooks/purity
  const ageMinutes = completedAt ? Math.floor((Date.now() - completedAt.getTime()) / 60000) : null
  const isOutdated = ageMinutes === null || ageMinutes > 45

  return (
    <article className="surface-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-caption leading-snug text-muted-foreground">
          {poolLabel}<br />swimmers now
        </span>
        <StatusPill level={isOutdated ? 'outdated' : 'live'} label={isOutdated ? 'Outdated' : 'Live'} />
      </div>
      <div className="mb-3 font-mono leading-none text-foreground" style={{ fontSize: 'clamp(32px, 3vw, 48px)' }}>
        {count !== null ? count.toLocaleString() : '—'}
      </div>
      <div className="text-caption text-muted-foreground/70">
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
        fetchWithTimeout(`/api/trail/chemistry?startDate=${sevenDaysAgo}&endDate=${today}`),
        fetchWithTimeout('/api/trail/bather-loads'),
      ])
      if (!chemRes.ok) throw new Error(`Chemistry API error: ${chemRes.status}`)
      if (!batherRes.ok) throw new Error(`Bather loads API error: ${batherRes.status}`)

      const chemData = await chemRes.json()
      const batherRaw = await batherRes.json()

      setLiveReadings(extractReadings(chemData as ChemApiData))
      setBatherData(parseBatherLoads(batherRaw.instances ?? [], batherRaw.recordLogs ?? {}))
    } catch (err) {
      setLiveError(loadErrorMessage(err))
    } finally {
      setLiveLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLiveData()
  }, [fetchLiveData])

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-border">
          <div>
            <h1 className="text-title">Pool Chemistry</h1>
            <p className="mt-1 text-callout text-muted-foreground">Live water quality and bather load data from Trail.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="chem-site-select" className="sr-only">Site</label>
            <select
              id="chem-site-select"
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(Number(e.target.value))}
              className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button
              onClick={fetchLiveData}
              disabled={liveLoading}
              aria-label="Refresh chemistry data"
              className="flex items-center gap-2 h-9 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <RefreshCw className={`size-4 ${liveLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {liveError && (
          <div role="alert" aria-live="polite" className="rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive ring-1 ring-inset ring-destructive/20">{liveError}</div>
        )}

        {/* Bather load KPI strip */}
        <div className="space-y-2">
          <h2 className="text-headline text-foreground">Bather loads</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="space-y-2">
          <h2 className="text-headline text-foreground">Pool chemistry</h2>
          {liveLoading && liveReadings.length === 0 ? (
            <LoadingState label="Loading chemistry data…" />
          ) : sitePoolLabels.filter(p => p !== 'Chlorine & CO2').length === 0 ? (
            <div className="surface-card px-6 py-12 text-center text-[15px] text-muted-foreground">No pools configured for this site.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
