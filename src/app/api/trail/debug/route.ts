import { NextResponse } from 'next/server'
import { fetchAllTaskInstances, fetchRecordLogs, CHEMISTRY_TEMPLATE_IDS, HANDOVER_TEMPLATE_IDS, type TrailRecordLog } from '@/lib/trail/client'

// Temporary diagnostic endpoint — shows raw instance names, field names, and
// first record's raw field objects so we can verify the actual API shape.
// Remove once field mapping is confirmed correct.
export async function GET() {
  try {
    const end = new Date()
    const start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const [chemInstances, handoverInstances] = await Promise.all([
      fetchAllTaskInstances(fmt(start), fmt(end), CHEMISTRY_TEMPLATE_IDS),
      fetchAllTaskInstances(fmt(start), fmt(end), HANDOVER_TEMPLATE_IDS),
    ])

    const chemIds = chemInstances.filter(i => i.completedDatetime).map(i => i.taskInstanceId)
    const handoverIds = handoverInstances.filter(i => i.completedDatetime).map(i => i.taskInstanceId)

    const [chemLogs, handoverLogs] = await Promise.all([
      chemIds.length > 0 ? fetchRecordLogs(chemIds.slice(0, 5)) : {},
      handoverIds.length > 0 ? fetchRecordLogs(handoverIds.slice(0, 5)) : {},
    ])

    function summarise(instances: typeof chemInstances, recordLogs: Record<string, TrailRecordLog[]>) {
      return instances.slice(0, 5).map(inst => {
        const logs = recordLogs[String(inst.taskInstanceId)] ?? []
        const firstRecord = logs[0]?.records[0] ?? null
        return {
          taskInstanceId: inst.taskInstanceId,
          taskInstanceName: inst.taskInstanceName,
          completed: !!inst.completedDatetime,
          fieldNames: [...new Set(logs.flatMap(l => l.records.flatMap(r => Object.keys(r))))],
          // Raw first record so we can inspect the actual field object shape
          rawFirstRecord: firstRecord,
        }
      })
    }

    return NextResponse.json({
      dateRange: `${fmt(start)} → ${fmt(end)}`,
      chemistry: summarise(chemInstances, chemLogs as Record<string, TrailRecordLog[]>),
      handovers: summarise(handoverInstances, handoverLogs as Record<string, TrailRecordLog[]>),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
