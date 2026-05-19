'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { ROLE_LABELS } from '@/lib/portal'
import { LogOut, User, Building2 } from 'lucide-react'

export default function TopBar() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/80 px-6 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.03),0_20px_40px_rgba(2,6,23,0.18)]">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Building2 className="w-4 h-4 text-emerald-400" />
        <span className="text-zinc-100 font-medium tracking-wide">LeisureWorld Cork</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 shadow-inner shadow-black/20">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/18 shadow-inner shadow-emerald-950/30">
            <User className="w-3.5 h-3.5 text-emerald-300" />
          </div>
          <div className="text-right pr-1">
            <p className="text-sm font-medium text-white leading-tight">{user.name}</p>
            <p className="text-[11px] text-slate-400">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-xl border border-white/0 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  )
}