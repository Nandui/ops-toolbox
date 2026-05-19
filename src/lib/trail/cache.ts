import { getDb } from '../db'

/**
 * Small Trail cache helpers shared by the API routes.
 *
 * The goal is to keep each route focused on its domain logic while this module
 * handles the repeated SQLite cache boilerplate and date defaults.
 */
type CachedRow = {
  data: string
  fetched_at: string
}

export function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]
}

export function getCachedJson<T>(key: string, ttlMinutes: number): { payload: T; cached: boolean } | null {
  const db = getDb()
  const cached = db.prepare('SELECT data, fetched_at FROM trail_cache WHERE key = ?').get(key) as CachedRow | undefined
  if (!cached) return null

  const ageMinutes = (Date.now() - new Date(cached.fetched_at + 'Z').getTime()) / 60000
  if (ageMinutes >= ttlMinutes) return null

  return {
    payload: JSON.parse(cached.data) as T,
    cached: true,
  }
}

export function setCachedJson(key: string, payload: unknown) {
  const db = getDb()
  db.prepare("INSERT OR REPLACE INTO trail_cache (key, data, fetched_at) VALUES (?, ?, datetime('now'))").run(
    key,
    JSON.stringify(payload),
  )
}
