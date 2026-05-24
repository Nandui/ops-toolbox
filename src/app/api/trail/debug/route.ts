import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTaskInstances, fetchRecordLogs, CHEMISTRY_TEMPLATE_IDS } from '@/lib/trail/client'

// Temporary diagnostic endpoint — shows raw instance names and field names
// from Trail for the last 14 days so we can verify template IDs and naming.
// Remove once field mapping is confirmed correct.
export async function GET(request: NextRequest) {
  try {
    const end = new Date()
    const start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const instances = await fetchAllTaskInstances(fmt(start), fmt(end), CHEMISTRY_TEMPLATE_IDS)

    const completedIds = instances.filter(i => i.completedDatetime).map(i => i.taskInstanceId)
    const recordLogs = completedIds.length > 0 ? await fetchRecordLogs(completedIds.slice(0, 20)) : {}

    const summary = instances.map(inst => {
      const logs = (recordLogs as Record<string, any[]>)[String(inst.taskInstanceId)] ?? []
      const fieldNames = [...new Set(
        logs.flatMap((l: any) => (l.records ?? []).flatMap((r: any) => Object.keys(r)))
      )]
      return {
        taskInstanceId: inst.taskInstanceId,
        taskInstanceName: inst.taskInstanceName,
        taskTemplateId: inst.taskTemplateId,
        siteName: inst.siteName,
        siteId: inst.siteId,
        completed: !!inst.completedDatetime,
        completedDatetime: inst.completedDatetime,
        fieldNames,
      }
    })

    return NextResponse.json({ dateRange: `${fmt(start)} → ${fmt(end)}`, count: instances.length, summary })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
