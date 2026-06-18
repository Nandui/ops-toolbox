'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { fetchWithTimeout, loadErrorMessage } from '@/lib/fetch'
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

// How far back to look for the latest reading.
const HISTORY_DAYS = 30

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

/** Most recent CO2 stock reading for a site, across all of its completed tasks. */
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
    status === 'ok'       ? 'pill-base pill-ok'
    : status === 'warning'  ? 'pill-base pill-warning'
    : status === 'critical' ? 'pill-base pill-critical'
    : 'pill-base pill-neutral'

  return (
    <span className={cls}>
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
    status === 'critical' ? 'bg-destructive'
    : status === 'warning'  ? 'bg-warning'
    : status === 'ok'       ? 'bg-success'
    : 'bg-muted-foreground/30'

  return (
    <article className="surface-card p-5">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h3 className="text-headline text-foreground">{label}</h3>
          <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
        </div>
        <StatusPill status={status} label={statusLabel} />
      </div>

      <div className="mt-5 flex items-end gap-5">
        {/* Tank level gauge */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-12 h-32 rounded-xl overflow-hidden bg-muted/60 ring-1 ring-inset ring-border">
            {/* Fill */}
            <div
              className={`absolute bottom-0 left-0 right-0 transition-all duration-700 ${fillColor}`}
              style={{ height: `${fillPct}%` }}
            />
            {/* Tick marks */}
            {[75, 50, 25].map(pct => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-border"
                style={{ bottom: `${pct}%` }}
              />
            ))}
            {/* Percentage overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-semibold text-foreground drop-shadow">
                {value !== null ? `${Math.round(fillPct)}%` : '—'}
              </span>
            </div>
          </div>
          <span className="text-caption text-muted-foreground/70">of {capacity} L</span>
        </div>

        {/* Numeric value */}
        <div className="flex-1 min-w-0">
          <div className="font-mono leading-none text-foreground" style={{ fontSize: 'clamp(40px, 5vw, 60px)' }}>
            {value !== null ? Math.round(value) : '—'}
            {value !== null && (
              <span className="ml-2 text-2xl text-muted-foreground">L</span>
            )}
          </div>
          <div className="mt-3 space-y-1 text-caption text-muted-foreground/70">
            <div>Capacity {capacity} L · Critical below {CRITICAL_PCT}%</div>
            {readingTime
              ? <div>Last reading: {readingTime}</div>
              : <div>No reading found in the last {HISTORY_DAYS} days</div>
            }
          </div>
        </div>
      </div>
    </article>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlantRoomPage() {
  const [stockReading, setStockReading] = useState<StockReading | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [selectedSiteId, setSelectedSiteId] = useState<number>(SITES[0].id)

  const fetchData = useCallback(async (siteId: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithTimeout(
        `/api/trail/chemistry?startDate=${daysAgoKey(HISTORY_DAYS)}&endDate=${todayKey()}`
      )
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json() as ChemApiData
      setStockReading(extractStockReading(data, siteId))
    } catch (err) {
      setError(loadErrorMessage(err))
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-title">Plant Room</h1>
          <p className="mt-1 text-callout text-muted-foreground">Current chlorine stock levels from Trail.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="plant-site-select" className="sr-only">Site</label>
          <select
            id="plant-site-select"
            value={selectedSiteId}
            onChange={e => setSelectedSiteId(Number(e.target.value))}
            className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            onClick={() => fetchData(selectedSiteId)}
            disabled={loading}
            aria-label="Refresh plant room data"
            className="flex items-center gap-2 h-9 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive ring-1 ring-inset ring-destructive/20">
          {error}
        </div>
      )}

      {loading && !stockReading ? (
        <LoadingState label="Loading plant room data…" />
      ) : !stockReading ? (
        <div className="surface-card px-6 py-12 text-center text-[15px] text-muted-foreground">
          No chlorine stock data found for this site in the last {HISTORY_DAYS} days.
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

    </div>
  )
}
