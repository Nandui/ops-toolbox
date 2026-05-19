'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FlaskConical, CheckSquare, BarChart3,
  AlertTriangle, ClipboardList, Settings, Users, ChevronRight,
  Waves
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/portal'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',            label: 'Overview',       icon: LayoutDashboard },
  { href: '/dashboard/chemistry',  label: 'Pool Chemistry', icon: FlaskConical },
  { href: '/dashboard/tasks',      label: 'Task Board',     icon: CheckSquare },
  { href: '/dashboard/scores',     label: 'Site Scores',    icon: BarChart3 },
  { href: '/dashboard/incidents',  label: 'Incidents',      icon: AlertTriangle },
  { href: '/dashboard/handovers',  label: 'Handovers',      icon: ClipboardList },
]

const ADMIN_ITEMS: NavItem[] = [
  { href: '/dashboard/admin/users',     label: 'Users',    icon: Users,    roles: ['admin'] },
  { href: '/dashboard/admin/settings',  label: 'Settings', icon: Settings, roles: ['admin'] },
]

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()

  return (
    <aside className="w-[17rem] flex shrink-0 flex-col border-r border-white/12 bg-slate-900/90 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <div className="flex items-center gap-2.5 border-b border-white/10 bg-white/[0.03] px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/18 shadow-inner shadow-emerald-950/30">
          <Waves className="w-4 h-4 text-emerald-300" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight tracking-wide">LeisureWorld</p>
          <p className="text-[11px] text-slate-400 uppercase tracking-[0.22em]">Manager Portal</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all group',
                isActive
                  ? 'border border-emerald-500/20 bg-emerald-500/14 text-emerald-300 shadow-[0_8px_18px_rgba(16,185,129,0.10)]'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
            </Link>
          )
        })}

        {/* Admin section */}
        {role === 'admin' && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Admin</p>
            </div>
            {ADMIN_ITEMS.map(item => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                    isActive
                      ? 'border border-emerald-500/20 bg-emerald-500/14 text-emerald-300'
                      : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Bottom: version */}
      <div className="border-t border-white/10 px-5 py-3 bg-white/[0.02]">
        <p className="text-[10px] text-slate-500">v1.0.0 · LeisureWorld Cork</p>
      </div>
    </aside>
  )
}
