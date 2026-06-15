'use client'

import { useState } from 'react'
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider'
import Sidebar from '@/components/shell/Sidebar'
import TopBar from '@/components/shell/TopBar'
import { Spinner } from '@/components/ui/loading-state'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [navOpen, setNavOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <Spinner className="size-7" />
        <p className="mt-4 text-[15px] text-white/40">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden text-foreground">
      <Sidebar role={user.role} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setNavOpen(true)} />
        <main className="flex-1 overflow-y-auto px-5 py-6 md:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}
