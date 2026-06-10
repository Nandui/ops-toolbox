import { getSql } from '../db'

/**
 * Small Trail cache helpers shared by the API routes.
 *
 * The goal is to keep each route focused on its domain logic while this module
 * handles the repeated cache boilerplate and date defaults.
 */
type CachedRow = {
  data: string
  fetched_at: string | Date
}

export function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]
}

export async function getCachedJson<T>(key: string, ttlMinutes: number): Promise<{ payload: T; cached: boolean } | null> {
  const sql = await getSql()
  const rows = await sql`SELECT data, fetched_at FROM trail_cache WHERE key = ${key}` as CachedRow[]
  const cached = rows[0]
  if (!cached) return null

  const ageMinutes = (Date.now() - new Date(cached.fetched_at).getTime()) / 60000
  if (ageMinutes >= ttlMinutes) return null

  return {
    payload: JSON.parse(cached.data) as T,
    cached: true,
  }
}

export async function setCachedJson(key: string, payload: unknown) {
  const sql = await getSql()
  await sql`
    INSERT INTO trail_cache (key, data, fetched_at) VALUES (${key}, ${JSON.stringify(payload)}, now())
    ON CONFLICT (key) DO UPDATE SET data = excluded.data, fetched_at = now()`
}
