import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTaskInstances, fetchRecordLogs, INCIDENT_TEMPLATE_IDS } from '@/lib/trail/client'
import { daysAgoIso, getCachedJson, setCachedJson, todayIso } from '@/lib/trail/cache'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const today = todayIso()
    const startDate = searchParams.get('startDate') || daysAgoIso(30)
    const endDate = searchParams.get('endDate') || today
    const cacheKey = `incidents:${startDate}:${endDate}`

    const cached = await getCachedJson<{ instances: unknown[]; recordLogs: Record<string, unknown>; fetchedAt: string }>(cacheKey, 10)
    if (cached) {
      return NextResponse.json({ ...cached.payload, cached: true })
    }

    const instances = await fetchAllTaskInstances(startDate, endDate, INCIDENT_TEMPLATE_IDS)
    const completedIds = instances
      .filter(t => t.completedDatetime)
      .map(t => t.taskInstanceId)

    let recordLogs: Record<string, unknown> = {}
    if (completedIds.length > 0) {
      recordLogs = await fetchRecordLogs(completedIds)
    }

    const result = { instances, recordLogs, fetchedAt: new Date().toISOString() }
    await setCachedJson(cacheKey, result)

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Incidents API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
