'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { ROLE_LABELS } from '@/lib/portal'
import { LogOut, User } from 'lucide-react'

export default function TopBar() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-slate-900/80 px-6 backdrop-blur-xl">

      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500">
        LeisureWorld Cork
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-emerald-500/20 bg-emerald-500/10">
            <User className="w-3 h-3 text-emerald-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-white leading-tight">{user.name}</p>
            <p className="text-[10px] font-mono text-slate-500">
              {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 border border-transparent px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-white"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block text-[11px] font-mono uppercase tracking-wider">Sign out</span>
        </button>
      </div>

    </header>
  )
}
