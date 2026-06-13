import { NextResponse } from 'next/server'
import { fetchTaskTemplates, fetchAllTaskInstances } from '@/lib/trail/client'
import { daysAgoIso, todayIso } from '@/lib/trail/cache'

// Diagnostic: fetch all templates + all task instances for the last 14 days
// and return a breakdown of every status value with sample tasks.
// Hit /api/trail/debug/task-statuses to see exactly what Trail returns.
export async function GET() {
  try {
    const templates = await fetchTaskTemplates()
    const templateIds = templates.map(t => t.id)

    const startDate = daysAgoIso(14)
    const endDate = todayIso()
    const all = await fetchAllTaskInstances(startDate, endDate, templateIds)

    // Group by status, keep 2 samples each
    const byStatus: Record<string, { count: number; samples: unknown[] }> = {}
    for (const inst of all) {
      const s = (inst as { status: string }).status ?? '(missing)'
      if (!byStatus[s]) byStatus[s] = { count: 0, samples: [] }
      byStatus[s].count++
      if (byStatus[s].samples.length < 2) byStatus[s].samples.push(inst)
    }

    return NextResponse.json({
      dateRange: `${startDate} → ${endDate}`,
      templateCount: templateIds.length,
      totalInstances: all.length,
      byStatus,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
