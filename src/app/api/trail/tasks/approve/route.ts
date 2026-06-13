import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken, verifySession } from '@/lib/auth'
import { approveTaskInstances } from '@/lib/trail/client'
import { clearCachedJson } from '@/lib/trail/cache'

/**
 * Approve (sign off) one or more Trail task instances that are sitting in
 * "Pending approval". Auth-gated to a logged-in portal user; the approver's
 * name is forwarded to Trail for the audit trail.
 *
 * On success the cached task list for the affected date is dropped so the next
 * read reflects the new statuses. Any error from Trail is surfaced verbatim so
 * a misconfigured endpoint fails visibly rather than silently.
 */
export async function POST(request: NextRequest) {
  const token = readSessionToken(request)
  const user = token ? await verifySession(token) : null
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { taskInstanceIds, date } = (body ?? {}) as { taskInstanceIds?: unknown; date?: string }
  const ids = Array.isArray(taskInstanceIds)
    ? taskInstanceIds.map(Number).filter(n => Number.isFinite(n))
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'taskInstanceIds (non-empty array) is required' }, { status: 400 })
  }

  try {
    const result = await approveTaskInstances(ids, user.name)
    if (date) await clearCachedJson(`tasks:${date}`)
    return NextResponse.json({ ok: true, approved: ids, result })
  } catch (err) {
    // Surface Trail's real status/body (embedded in the thrown message) so the
    // client can show exactly why an approval was rejected.
    console.error('Task approval error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }
}
