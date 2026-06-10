import Database from 'better-sqlite3'
import path from 'path'
import * as fs from 'fs'
import * as bcrypt from 'bcryptjs'
import { SITES, USER_ROLES } from '../portal'

/**
 * SQLite-backed persistence for the portal.
 *
 * This file owns schema creation and seed data so the rest of the app can treat
 * the database as a stable service, not a pile of ad-hoc SQL strings.
 */
// Vercel's project root is read-only; /tmp is writable (ephemeral per instance)
const DB_PATH = process.env.VERCEL
  ? '/tmp/app.db'
  : path.join(process.cwd(), 'data', 'app.db')
const ROLE_CHECK_LIST = USER_ROLES.map(role => `'${role}'`).join(', ')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN (${ROLE_CHECK_LIST})),
      site_ids TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      pools TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS trail_cache (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trail_poll_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      polled_at TEXT NOT NULL DEFAULT (datetime('now')),
      endpoint TEXT NOT NULL,
      status TEXT NOT NULL,
      record_count INTEGER DEFAULT 0,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS chemistry_thresholds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric TEXT NOT NULL UNIQUE,
      low_warning REAL,
      ok_low REAL,
      ok_high REAL,
      high_warning REAL,
      unit TEXT NOT NULL DEFAULT 'ppm',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ops_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(site_id, log_date)
    );
  `)
  seedInitialData(database)
}

function seedInitialData(database: Database.Database) {
  const siteCount = (database.prepare('SELECT COUNT(*) as c FROM sites').get() as { c: number }).c
  if (siteCount === 0) {
    const ins = database.prepare('INSERT OR IGNORE INTO sites (id, name, status, pools) VALUES (?, ?, ?, ?)')
    for (const site of SITES) {
      ins.run(site.id, site.name, 'active', JSON.stringify(site.pools))
    }
  }

  const threshCount = (database.prepare('SELECT COUNT(*) as c FROM chemistry_thresholds').get() as { c: number }).c
  if (threshCount === 0) {
    const ins = database.prepare('INSERT INTO chemistry_thresholds (metric, low_warning, ok_low, ok_high, high_warning, unit) VALUES (?, ?, ?, ?, ?, ?)')
    ins.run('free_chlorine',     0.5,  0.5,  3.0,  3.0,  'ppm')
    ins.run('total_chlorine',    null, 1.0,  4.0,  4.0,  'ppm')
    ins.run('combined_chlorine', null, 0.0,  1.0,  1.0,  'ppm')
    ins.run('ph',                7.2,  7.2,  7.8,  7.8,  'pH')
    ins.run('water_temp',        null, 26.0, 32.0, 32.0, '°C')
  }

  const adminEmail = 'admin@leisureworld.ie'
  const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)
  if (!existing) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const hash = bcrypt.hashSync(adminPassword, 10)
    database.prepare(`
      INSERT INTO users (email, name, password_hash, role, site_ids)
      VALUES (?, ?, ?, 'admin', '[]')
    `).run(adminEmail, 'Fernando Serina', hash)
  }

  const setSetting = database.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)')
  setSetting.run('poll_interval_minutes', '5')
  setSetting.run('app_name', 'LeisureWorld Portal')
  setSetting.run('timezone', 'Europe/Dublin')
}
