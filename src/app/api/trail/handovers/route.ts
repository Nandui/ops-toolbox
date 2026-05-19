import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTaskInstances, fetchRecordLogs, HANDOVER_TEMPLATE_IDS } from '@/lib/trail/client'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const today = new Date().toISOString().split('T')[0]
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || today

    const db = getDb()
    const cacheKey = `handovers:${startDate}:${endDate}`
    const cached = db.prepare('SELECT data, fetched_at FROM trail_cache WHERE key = ?').get(cacheKey) as
      { data: string; fetched_at: string } | undefined

    const cacheAgeMinutes = cached
      ? (Date.now() - new Date(cached.fetched_at + 'Z').getTime()) / 60000
      : Infinity

    if (cached && cacheAgeMinutes < 10) {
      return NextResponse.json({ ...JSON.parse(cached.data), cached: true })
    }

    const instances = await fetchAllTaskInstances(startDate, endDate, HANDOVER_TEMPLATE_IDS)
    const completedIds = instances
      .filter(t => t.completedDatetime)
      .map(t => t.taskInstanceId)

    let recordLogs: Record<string, unknown> = {}
    if (completedIds.length > 0) {
      recordLogs = await fetchRecordLogs(completedIds)
    }

    const result = { instances, recordLogs, fetchedAt: new Date().toISOString() }

    db.prepare("INSERT OR REPLACE INTO trail_cache (key, data, fetched_at) VALUES (?, ?, datetime('now'))").run(
      cacheKey, JSON.stringify(result)
    )

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Handovers API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
