import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTaskInstances, TEMPLATE_IDS } from '@/lib/trail/client'
import { getCachedJson, setCachedJson, todayIso } from '@/lib/trail/cache'

// All relevant daily operational templates
const DAILY_TEMPLATE_IDS = [
  TEMPLATE_IDS.pool25m, TEMPLATE_IDS.pool18m, TEMPLATE_IDS.poolLearners,
  TEMPLATE_IDS.chlorineCO2Stock,
  TEMPLATE_IDS.poolAlarmTest,
  TEMPLATE_IDS.bathrLoads,
  TEMPLATE_IDS.rescueEquipBT,
  TEMPLATE_IDS.incidentBT, TEMPLATE_IDS.incidentDG, TEMPLATE_IDS.nearMissDG,
  TEMPLATE_IDS.handoverBT, TEMPLATE_IDS.handoverCF,
  TEMPLATE_IDS.dailyOpsLog,
  TEMPLATE_IDS.alkalinity25m, TEMPLATE_IDS.alkalinity18m, TEMPLATE_IDS.alkalinityLearners,
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const today = todayIso()
    const startDate = searchParams.get('date') || today
    const cacheKey = `tasks:${startDate}`

    const cached = await getCachedJson<{ instances: unknown[]; fetchedAt: string }>(cacheKey, 5)

    if (cached) {
      return NextResponse.json({ ...cached.payload, cached: true })
    }

    const instances = await fetchAllTaskInstances(startDate, startDate, DAILY_TEMPLATE_IDS)
    const result = { instances, fetchedAt: new Date().toISOString() }

    await setCachedJson(cacheKey, result)

    if (searchParams.get('debug') === '1') {
      const statuses = [...new Set(instances.map(i => (i as { status: string }).status))]
      return NextResponse.json({ statuses, sample: instances.slice(0, 3), cached: false })
    }

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Tasks API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
