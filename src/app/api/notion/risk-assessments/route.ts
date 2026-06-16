import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { fetchRiskAssessments } from '@/lib/notion/risk-assessments'

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

    const result = await fetchRiskAssessments()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Notion risk-assessments GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
