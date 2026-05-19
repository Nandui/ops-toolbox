import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '../../../../lib/auth'
import {
  createIncidentPage,
  fetchActiveIncidents,
  getIncidentOptions,
  resolveNotionReporter,
} from '../../../../lib/notion/incidents'

async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get('lw_session')?.value
  if (!token) return null
  return verifySession(token)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const [incidents, reporter] = await Promise.all([
      fetchActiveIncidents(),
      resolveNotionReporter(user.email),
    ])

    return NextResponse.json({
      incidents,
      options: getIncidentOptions(),
      reporter,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Notion incidents GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const reportTitle = String(body.reportTitle || '').trim()
    const site = String(body.site || '').trim()
    const incidentDate = String(body.incidentDate || '').trim()
    const incidentTime = String(body.incidentTime || '').trim()
    const category = String(body.category || '').trim()
    const severity = String(body.severity || '').trim()
    const likelyArea = String(body.likelyArea || '').trim()
    const description = String(body.description || '').trim()
    const peopleInvolved = String(body.peopleInvolved || '').trim()
    const reviewNotes = String(body.reviewNotes || '').trim()
    const fileUrls = Array.isArray(body.fileUrls)
      ? body.fileUrls.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : []

    const required: Array<[string, string]> = [
      ['site', site],
      ['incidentDate', incidentDate],
      ['category', category],
      ['severity', severity],
      ['likelyArea', likelyArea],
      ['description', description],
    ]

    const missing = required.filter(([, value]) => !value).map(([field]) => field)
    if (missing.length) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    const reporter = await resolveNotionReporter(user.email)
    const created = await createIncidentPage({
      reportTitle: reportTitle || `Incident submission - ${site} - ${incidentDate}`,
      site,
      incidentDate,
      incidentTime,
      category,
      severity,
      likelyArea,
      description,
      peopleInvolved,
      reviewNotes,
      fileUrls,
      reporterNotionUserId: reporter?.id ?? null,
      reporterName: reporter?.name ?? user.name,
    })

    return NextResponse.json({
      ok: true,
      pageId: created.id,
      url: created.url,
      title: reportTitle || `Incident submission - ${site} - ${incidentDate}`,
      reporterMatched: Boolean(reporter),
    })
  } catch (error) {
    console.error('Notion incidents POST error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
