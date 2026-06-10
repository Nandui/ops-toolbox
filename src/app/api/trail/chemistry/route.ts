import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTaskInstances, fetchRecordLogs, CHEMISTRY_TEMPLATE_IDS } from '@/lib/trail/client'
import { getCachedJson, setCachedJson, todayIso } from '@/lib/trail/cache'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const today = todayIso()
    const startDate = searchParams.get('startDate') || today
    const endDate = searchParams.get('endDate') || today
    const cacheKey = `chemistry:${startDate}:${endDate}`

    const cached = await getCachedJson<{ instances: unknown[]; recordLogs: Record<string, unknown>; fetchedAt: string }>(cacheKey, 5)
    if (cached) {
      return NextResponse.json({ ...cached.payload, cached: true })
    }

    // Fetch from Trail API
    const instances = await fetchAllTaskInstances(startDate, endDate, CHEMISTRY_TEMPLATE_IDS)
    const completedIds = instances
      .filter(t => t.completedDatetime)
      .map(t => t.taskInstanceId)

    const recordLogs: Record<string, unknown> = {}
    for (let i = 0; i < completedIds.length; i += 1000) {
      const chunk = completedIds.slice(i, i + 1000)
      const logs = await fetchRecordLogs(chunk)
      Object.assign(recordLogs, logs)
    }

    const result = { instances, recordLogs, fetchedAt: new Date().toISOString() }
    await setCachedJson(cacheKey, result)

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Chemistry API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
