'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import {
  LayoutDashboard, FlaskConical, CheckSquare, BarChart3,
  AlertTriangle, ClipboardList, Settings, Users, Waves,
  CalendarDays, ClipboardEdit, LogOut, X, ShoppingCart, Gauge, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/AuthProvider'
import { ROLE_LABELS } from '@/lib/portal'
import type { UserRole } from '@/lib/portal'
import { Button } from '@/components/ui/button'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Daily',
    items: [
      { href: '/dashboard/ops-log',   label: 'Ops Log',   icon: CalendarDays  },
      { href: '/dashboard/dept-plan', label: 'Dept Plan', icon: ClipboardEdit },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { href: '/dashboard/chemistry',   label: 'Pool Chemistry', icon: FlaskConical  },
      { href: '/dashboard/plant-room', label: 'Plant Room',    icon: Gauge         },
      { href: '/dashboard/tasks',      label: 'Task Board',    icon: CheckSquare   },
      { href: '/dashboard/scores',    label: 'Site Scores',    icon: BarChart3     },
      { href: '/dashboard/incidents', label: 'Incidents',      icon: AlertTriangle },
      { href: '/dashboard/risk-assessments', label: 'Risk Assessments', icon: ShieldCheck },
      { href: '/dashboard/handovers', label: 'Handovers',      icon: ClipboardList },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    ],
  },
]

const ADMIN_GROUP: NavGroup = {
  label: 'Admin',
  items: [
    { href: '/dashboard/admin/users',    label: 'Users',    icon: Users    },
    { href: '/dashboard/admin/settings', label: 'Settings', icon: Settings },
  ],
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {isActive && (
        <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" aria-hidden />
      )}
      <item.icon className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground')} />
      <span>{item.label}</span>
    </Link>
  )
}

export default function Sidebar({
  role,
  open = false,
  onClose,
}: {
  role: UserRole
  open?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  // Close the mobile drawer after navigating
  useEffect(() => {
    onClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const groups = role === 'admin' ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS

  const initials = (user?.name ?? '')
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'hairline-r fixed inset-y-0 left-0 z-50 flex w-[16.5rem] flex-col bg-sidebar transition-transform duration-200 ease-out',
          'lg:static lg:z-auto lg:translate-x-0 lg:transition-none',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >

        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(2_6_23/0.12)]">
            <Waves className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-subhead leading-tight font-semibold text-foreground">LeisureWorld</p>
            <p className="text-caption text-muted-foreground">Manager Portal</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          {groups.map((group, i) => (
            <div key={group.label ?? i} className="space-y-0.5">
              {group.label && (
                <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                  {group.label}
                </p>
              )}
              {group.items.map(item => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return <NavLink key={item.href} item={item} isActive={isActive} />
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div className="hairline-t flex items-center gap-3 px-4 py-3.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-subhead leading-tight font-medium text-foreground">{user.name}</p>
              <p className="truncate text-caption text-muted-foreground">
                {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut />
            </Button>
          </div>
        )}

      </aside>
    </>
  )
}
