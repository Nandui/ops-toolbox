import { NextResponse } from 'next/server'
import { fetchAllTaskInstances, fetchRecordLogs, TEMPLATE_IDS } from '@/lib/trail/client'
import { getCachedJson, setCachedJson, todayIso } from '@/lib/trail/cache'

export async function GET() {
  try {
    const today = todayIso()
    const cacheKey = `bather-loads:${today}`

    const cached = await getCachedJson<{ instances: unknown[]; recordLogs: Record<string, unknown>; fetchedAt: string }>(cacheKey, 5)
    if (cached) return NextResponse.json({ ...cached.payload, cached: true })

    const instances = await fetchAllTaskInstances(today, today, [TEMPLATE_IDS.bathrLoads])
    const completedIds = instances.filter(t => t.completedDatetime).map(t => t.taskInstanceId)
    const recordLogs = completedIds.length > 0 ? await fetchRecordLogs(completedIds) : {}

    const result = { instances, recordLogs, fetchedAt: new Date().toISOString() }
    await setCachedJson(cacheKey, result)

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Bather loads API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
