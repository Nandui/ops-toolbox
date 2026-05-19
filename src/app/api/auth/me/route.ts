import { NextRequest, NextResponse } from 'next/server'
import { readSessionToken, verifySession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = readSessionToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await verifySession(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    siteIds: user.siteIds,
  })
}