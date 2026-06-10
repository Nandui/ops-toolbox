import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken, verifySession } from '@/lib/auth'
import { getSql } from '@/lib/db'

/**
 * Ops log lifecycle:
 *  - Logs start as 'draft' and can be edited freely.
 *  - Approving locks the log ('approved') and enables printing.
 *  - Edits after approval are still allowed, but every field change is
 *    recorded in ops_log_changes (who, when, what, old → new).
 */

interface OpsRow {
  name: string; shift: string; breakMins: string
  break1: string; break2: string; break3: string
  duties: string; extra: string
}
interface OpsSection { id: string; title: string; rows: OpsRow[] }
interface OpsLogData { sections: OpsSection[]; poolBookings: string; gymBookings: string }

interface OpsLogRecord {
  id: number
  data: OpsLogData
  status: 'draft' | 'approved'
  approved_by: string | null
  approved_at: string | Date | null
  updated_by: string | null
  updated_at: string | Date
}

async function auth(request: NextRequest) {
  const token = readSessionToken(request)
  if (!token) return null
  return verifySession(token)
}

const FIELD_LABELS: Record<keyof OpsRow, string> = {
  name: 'Name', shift: 'Shift', breakMins: 'Breaks',
  break1: '1st 15', break2: '30 min', break3: '2nd 15',
  duties: 'Duties', extra: 'Cover/Extra',
}

function rowSummary(r: OpsRow) {
  return [r.name, r.shift, r.duties, r.extra].filter(Boolean).join(' · ')
}

/** Field-level diff between two log payloads, for the audit trail. */
function diffLogs(oldData: OpsLogData, newData: OpsLogData) {
  const changes: { section: string; staffName: string; field: string; oldValue: string; newValue: string }[] = []

  for (const newSection of newData.sections) {
    const oldSection = oldData.sections?.find(s => s.id === newSection.id)
    const oldRows = [...(oldSection?.rows ?? [])]

    for (const newRow of newSection.rows) {
      // Match by staff name first, falling back to position for unnamed rows
      const idx = oldRows.findIndex(r => r.name.trim() !== '' && r.name.trim() === newRow.name.trim())
      const oldRow = idx >= 0 ? oldRows.splice(idx, 1)[0] : undefined

      if (!oldRow) {
        if (rowSummary(newRow)) {
          changes.push({ section: newSection.title, staffName: newRow.name || '(unnamed)', field: 'Row added', oldValue: '—', newValue: rowSummary(newRow) })
        }
        continue
      }
      for (const key of Object.keys(FIELD_LABELS) as (keyof OpsRow)[]) {
        if ((oldRow[key] ?? '') !== (newRow[key] ?? '')) {
          changes.push({
            section: newSection.title,
            staffName: newRow.name || oldRow.name || '(unnamed)',
            field: FIELD_LABELS[key],
            oldValue: oldRow[key] || '—',
            newValue: newRow[key] || '—',
          })
        }
      }
    }
    // Anything left in oldRows was removed
    for (const removed of oldRows) {
      if (rowSummary(removed)) {
        changes.push({ section: newSection.title, staffName: removed.name || '(unnamed)', field: 'Row removed', oldValue: rowSummary(removed), newValue: '—' })
      }
    }
  }

  if ((oldData.poolBookings ?? '') !== (newData.poolBookings ?? '')) {
    changes.push({ section: 'Bookings', staffName: 'Pool', field: 'Pool bookings', oldValue: oldData.poolBookings || '—', newValue: newData.poolBookings || '—' })
  }
  if ((oldData.gymBookings ?? '') !== (newData.gymBookings ?? '')) {
    changes.push({ section: 'Bookings', staffName: 'Gym', field: 'Gym bookings', oldValue: oldData.gymBookings || '—', newValue: newData.gymBookings || '—' })
  }
  return changes
}

async function loadLog(siteId: number, date: string): Promise<OpsLogRecord | null> {
  const sql = await getSql()
  const rows = await sql`
    SELECT id, data, status, approved_by, approved_at, updated_by, updated_at
    FROM ops_logs WHERE site_id = ${siteId} AND log_date = ${date}` as unknown as OpsLogRecord[]
  return rows[0] ?? null
}

async function loadChanges(opsLogId: number) {
  const sql = await getSql()
  return sql`
    SELECT changed_by, changed_at, section, staff_name, field, old_value, new_value
    FROM ops_log_changes WHERE ops_log_id = ${opsLogId}
    ORDER BY changed_at DESC, id DESC`
}

export async function GET(request: NextRequest) {
  const user = await auth(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const date = searchParams.get('date')
  const siteId = Number(searchParams.get('siteId'))
  if (!date || !siteId) return NextResponse.json({ error: 'date and siteId required' }, { status: 400 })

  const record = await loadLog(siteId, date)
  if (!record) return NextResponse.json({ log: null })

  const changes = await loadChanges(record.id)
  return NextResponse.json({
    log: record.data,
    status: record.status,
    approvedBy: record.approved_by,
    approvedAt: record.approved_at,
    updatedBy: record.updated_by,
    updatedAt: record.updated_at,
    changes,
  })
}

export async function PUT(request: NextRequest) {
  const user = await auth(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { date, siteId, data, action } = body as { date: string; siteId: number; data: OpsLogData; action?: 'save' | 'approve' }
  if (!date || !siteId || !data) return NextResponse.json({ error: 'date, siteId, data required' }, { status: 400 })

  const sql = await getSql()
  const existing = await loadLog(siteId, date)

  // Audit every change made after approval
  if (existing && existing.status === 'approved') {
    const changes = diffLogs(existing.data, data)
    for (const c of changes) {
      await sql`
        INSERT INTO ops_log_changes (ops_log_id, changed_by, section, staff_name, field, old_value, new_value)
        VALUES (${existing.id}, ${user.name}, ${c.section}, ${c.staffName}, ${c.field}, ${c.oldValue}, ${c.newValue})`
    }
  }

  const approving = action === 'approve'
  if (existing) {
    if (approving && existing.status === 'draft') {
      await sql`
        UPDATE ops_logs SET data = ${JSON.stringify(data)}::jsonb, status = 'approved',
          approved_by = ${user.name}, approved_at = now(),
          updated_by = ${user.name}, updated_at = now()
        WHERE id = ${existing.id}`
    } else {
      await sql`
        UPDATE ops_logs SET data = ${JSON.stringify(data)}::jsonb,
          updated_by = ${user.name}, updated_at = now()
        WHERE id = ${existing.id}`
    }
  } else {
    await sql`
      INSERT INTO ops_logs (site_id, log_date, data, status, approved_by, approved_at, updated_by)
      VALUES (${siteId}, ${date}, ${JSON.stringify(data)}::jsonb,
        ${approving ? 'approved' : 'draft'},
        ${approving ? user.name : null}, ${approving ? new Date().toISOString() : null},
        ${user.name})`
  }

  const record = await loadLog(siteId, date)
  const changes = record ? await loadChanges(record.id) : []
  return NextResponse.json({
    ok: true,
    status: record?.status ?? 'draft',
    approvedBy: record?.approved_by ?? null,
    approvedAt: record?.approved_at ?? null,
    updatedBy: record?.updated_by ?? null,
    updatedAt: record?.updated_at ?? null,
    changes,
  })
}
