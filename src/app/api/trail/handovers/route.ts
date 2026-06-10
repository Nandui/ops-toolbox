import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTaskInstances, fetchRecordLogs, HANDOVER_TEMPLATE_IDS } from '@/lib/trail/client'
import { getCachedJson, setCachedJson } from '@/lib/trail/cache'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const today = new Date().toISOString().split('T')[0]
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || today

    const cacheKey = `handovers:${startDate}:${endDate}`
    const cached = await getCachedJson<Record<string, unknown>>(cacheKey, 10)
    if (cached) {
      return NextResponse.json({ ...cached.payload, cached: true })
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

    await setCachedJson(cacheKey, result)

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Handovers API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
