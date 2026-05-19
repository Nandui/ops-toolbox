'use client'

import { AuthProvider, useAuth } from '@/components/auth/AuthProvider'
import Sidebar from '@/components/shell/Sidebar'
import TopBar from '@/components/shell/TopBar'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading portal…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.07),transparent_30%),linear-gradient(180deg,rgba(15,20,27,1)_0%,rgba(10,13,18,1)_100%)] text-slate-100">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col bg-white/[0.01]">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
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