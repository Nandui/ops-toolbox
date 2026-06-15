import { NextResponse } from 'next/server'
import { fetchTaskTemplates, fetchAllTaskInstances } from '@/lib/trail/client'
import { todayIso, daysAgoIso } from '@/lib/trail/cache'

// TEMPORARY diagnostic route.
// Goal: find which raw field on a Trail task instance marks it as
// "pending approval" (the web UI filter approval=pending_approval),
// since the public API ignores that filter in the request body.
//
// Open /api/trail/debug/approval in the browser and share the
// `fields` + `knownPending` sections of the JSON.

// Task IDs the user confirmed are currently pending approval in Trail.
const KNOWN_PENDING = ['507647760', '507969253']

export async function GET() {
  try {
    const templates = await fetchTaskTemplates()
    const ids = templates.map(t => t.id)
    const start = daysAgoIso(14)
    const end = todayIso()
    const instances = (await fetchAllTaskInstances(start, end, ids)) as unknown as Record<string, unknown>[]

    // Build a compact fingerprint of every field present on the raw objects.
    // Low-cardinality fields (booleans / small enums) get a value distribution;
    // everything else just reports its type + an example.
    type FI = { types: Set<string>; distinct: Map<string, number>; tooMany: boolean; example: unknown }
    const fieldInfo: Record<string, FI> = {}

    for (const inst of instances) {
      for (const [k, v] of Object.entries(inst)) {
        if (!fieldInfo[k]) fieldInfo[k] = { types: new Set(), distinct: new Map(), tooMany: false, example: v }
        const fi = fieldInfo[k]
        fi.types.add(Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v)
        if (!fi.tooMany) {
          if (typeof v === 'boolean' || typeof v === 'string') {
            const key = String(v)
            fi.distinct.set(key, (fi.distinct.get(key) ?? 0) + 1)
            if (fi.distinct.size > 12) fi.tooMany = true
          } else {
            fi.tooMany = true
          }
        }
      }
    }

    const fields = Object.fromEntries(
      Object.entries(fieldInfo).map(([k, fi]) => [
        k,
        {
          types: [...fi.types],
          values: fi.tooMany ? null : Object.fromEntries(fi.distinct),
          example: fi.tooMany ? fi.example : undefined,
        },
      ])
    )

    const knownPending = Object.fromEntries(
      KNOWN_PENDING.map(id => [id, instances.find(i => String(i.taskInstanceId) === id) ?? null])
    )

    return NextResponse.json({
      window: { start, end },
      total: instances.length,
      fields,
      knownPending,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
