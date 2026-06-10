import { NextRequest, NextResponse } from 'next/server'
import { fetchScores } from '@/lib/trail/client'
import { daysAgoIso, getCachedJson, setCachedJson, todayIso } from '@/lib/trail/cache'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const endDate = todayIso()
    const startDate = searchParams.get('startDate') || daysAgoIso(30)
    const interval = (searchParams.get('interval') || 'day') as 'day' | 'week' | 'month'
    const cacheKey = `scores:${startDate}:${endDate}:${interval}`

    const cached = await getCachedJson<{ scores: unknown[] }>(cacheKey, 60)
    if (cached) {
      return NextResponse.json({ ...cached.payload, cached: true })
    }

    const scores = await fetchScores(startDate, endDate, interval)
    const result = { scores }
    await setCachedJson(cacheKey, result)

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Scores API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
