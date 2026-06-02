'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FlaskConical, CheckSquare, BarChart3,
  AlertTriangle, ClipboardList, Settings, Users, Waves
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
  { href: '/dashboard/chemistry',  label: 'Pool Chemistry', icon: FlaskConical    },
  { href: '/dashboard/tasks',      label: 'Task Board',     icon: CheckSquare     },
  { href: '/dashboard/scores',     label: 'Site Scores',    icon: BarChart3       },
  { href: '/dashboard/incidents',  label: 'Incidents',      icon: AlertTriangle   },
  { href: '/dashboard/handovers',  label: 'Handovers',      icon: ClipboardList   },
]

const ADMIN_ITEMS: NavItem[] = [
  { href: '/dashboard/admin/users',    label: 'Users',    icon: Users    },
  { href: '/dashboard/admin/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()

  return (
    <aside className="w-[17rem] flex shrink-0 flex-col border-r border-white/[0.08] bg-slate-900/90 backdrop-blur-xl">

      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] bg-white/[0.02] px-5 py-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-emerald-400/25 bg-emerald-500/10">
          <Waves className="w-4 h-4 text-emerald-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-white leading-tight">LeisureWorld</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.22em] font-mono">Manager Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm transition-colors border',
                isActive
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  : 'border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {role === 'admin' && (
          <>
            <div className="pt-4 pb-1.5 px-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-600">Admin</p>
            </div>
            {ADMIN_ITEMS.map(item => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 text-sm transition-colors border',
                    isActive
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                      : 'border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white'
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.08] px-5 py-3">
        <p className="text-[10px] font-mono text-slate-600">v1.0.0 · LeisureWorld Cork</p>
      </div>

    </aside>
  )
}
