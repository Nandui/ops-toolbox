import { neon } from '@neondatabase/serverless'
import * as bcrypt from 'bcryptjs'
import { SITES, USER_ROLES } from '../portal'

/**
 * Neon Postgres persistence for the portal.
 *
 * This module owns schema creation and seed data so the rest of the app can
 * treat the database as a stable service. Call `getSql()` to obtain the query
 * function — it lazily initialises the schema once per process.
 */

export type Sql = ReturnType<typeof neon>

const ROLE_CHECK_LIST = USER_ROLES.map(role => `'${role}'`).join(', ')

let sqlClient: Sql | null = null
let schemaReady: Promise<void> | null = null

function connectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Install the Neon integration from the Vercel Marketplace ' +
      '(or create a Neon database and set DATABASE_URL) before running the app.'
    )
  }
  return url
}

export async function getSql(): Promise<Sql> {
  if (!sqlClient) sqlClient = neon(connectionString())
  if (!schemaReady) schemaReady = initSchema(sqlClient)
  await schemaReady
  return sqlClient
}

async function initSchema(sql: Sql) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN (${ROLE_CHECK_LIST})),
      site_ids TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)

  // Drop the inline role CHECK constraint so new roles can be added without a table rebuild.
  // Role validation is enforced at the API layer instead.
  await sql.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`)

  await sql.query(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      pools TEXT NOT NULL DEFAULT '[]'
    )`)

  await sql.query(`
    CREATE TABLE IF NOT EXISTS trail_cache (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)

  await sql.query(`
    CREATE TABLE IF NOT EXISTS trail_poll_log (
      id SERIAL PRIMARY KEY,
      polled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      endpoint TEXT NOT NULL,
      status TEXT NOT NULL,
      record_count INTEGER DEFAULT 0,
      error_message TEXT
    )`)

  await sql.query(`
    CREATE TABLE IF NOT EXISTS chemistry_thresholds (
      id SERIAL PRIMARY KEY,
      metric TEXT NOT NULL UNIQUE,
      low_warning REAL,
      ok_low REAL,
      ok_high REAL,
      high_warning REAL,
      unit TEXT NOT NULL DEFAULT 'ppm',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)

  await sql.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)

  await sql.query(`
    CREATE TABLE IF NOT EXISTS ops_logs (
      id SERIAL PRIMARY KEY,
      site_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      data JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(site_id, log_date)
    )`)

  await sql.query(`
    CREATE TABLE IF NOT EXISTS ops_log_changes (
      id SERIAL PRIMARY KEY,
      ops_log_id INTEGER NOT NULL REFERENCES ops_logs(id) ON DELETE CASCADE,
      changed_by TEXT NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      section TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT NOT NULL,
      new_value TEXT NOT NULL
    )`)

  await sql.query(`
    CREATE TABLE IF NOT EXISTS dept_plans (
      id SERIAL PRIMARY KEY,
      site_id INTEGER NOT NULL,
      plan_date TEXT NOT NULL,
      data JSONB NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(site_id, plan_date)
    )`)



  await seedInitialData(sql)
}

async function seedInitialData(sql: Sql) {
  for (const site of SITES) {
    await sql`
      INSERT INTO sites (id, name, status, pools)
      VALUES (${site.id}, ${site.name}, 'active', ${JSON.stringify(site.pools)})
      ON CONFLICT (id) DO NOTHING`
  }

  const thresholds: [string, number | null, number, number, number, string][] = [
    ['free_chlorine',     0.5,  0.5,  3.0,  3.0,  'ppm'],
    ['total_chlorine',    null, 1.0,  4.0,  4.0,  'ppm'],
    ['combined_chlorine', null, 0.0,  1.0,  1.0,  'ppm'],
    ['ph',                7.2,  7.2,  7.8,  7.8,  'pH'],
    ['water_temp',        null, 26.0, 32.0, 32.0, '°C'],
  ]
  for (const [metric, lowWarn, okLow, okHigh, highWarn, unit] of thresholds) {
    await sql`
      INSERT INTO chemistry_thresholds (metric, low_warning, ok_low, ok_high, high_warning, unit)
      VALUES (${metric}, ${lowWarn}, ${okLow}, ${okHigh}, ${highWarn}, ${unit})
      ON CONFLICT (metric) DO NOTHING`
  }

  const adminEmail = 'admin@leisureworld.ie'
  const existing = await sql`SELECT id FROM users WHERE email = ${adminEmail}` as { id: number }[]
  if (existing.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const hash = bcrypt.hashSync(adminPassword, 10)
    await sql`
      INSERT INTO users (email, name, password_hash, role, site_ids)
      VALUES (${adminEmail}, 'Fernando Serina', ${hash}, 'admin', '[]')
      ON CONFLICT (email) DO NOTHING`
  }

  const settings: [string, string][] = [
    ['poll_interval_minutes', '5'],
    ['app_name', 'LeisureWorld Portal'],
    ['timezone', 'Europe/Dublin'],
  ]
  for (const [key, value] of settings) {
    await sql`INSERT INTO system_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO NOTHING`
  }

}
