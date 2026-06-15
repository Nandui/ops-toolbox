import { NextRequest, NextResponse } from 'next/server'
import { buildSessionCookieOptions, createSession, SESSION_COOKIE_NAME } from '@/lib/auth'
import type { SessionUser } from '@/lib/auth'

const DEV_SESSIONS: Record<string, SessionUser> = {
  admin: {
    id: 1,
    email: 'admin@leisureworld.ie',
    name: 'Admin User',
    role: 'admin',
    siteIds: [],
  },
  duty_manager: {
    id: 2,
    email: 'duty@leisureworld.ie',
    name: 'Duty Manager',
    role: 'duty_manager',
    siteIds: [23201, 26173],
  },
  shift_supervisor: {
    id: 3,
    email: 'supervisor@leisureworld.ie',
    name: 'Shift Supervisor',
    role: 'shift_supervisor',
    siteIds: [23201],
  },
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') ?? 'admin'
    const user = DEV_SESSIONS[role] ?? DEV_SESSIONS.admin
    const token = await createSession(user)
    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(request))
    return response
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
