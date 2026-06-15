'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { SessionUser } from '@/lib/auth'

export type AuthUser = SessionUser

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  isAdmin: boolean
  isDutyManager: boolean
  isShiftSupervisor: boolean
  canAccessAllSites: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (!cancelled) {
          setUser(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Not authenticated — redirect to login
          window.location.href = '/login'
        }
      })
    return () => { cancelled = true }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }, [])

  const isAdmin         = user?.role === 'admin'
  const isDutyManager   = user?.role === 'duty_manager'
  const isShiftSupervisor = user?.role === 'shift_supervisor'
  const canAccessAllSites = isAdmin

  return (
    <AuthContext.Provider value={{ user, loading, logout, isAdmin, isDutyManager, isShiftSupervisor, canAccessAllSites }}>
      {children}
    </AuthContext.Provider>
  )
}