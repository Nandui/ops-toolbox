'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Longest-prefix match first; '/dashboard' last as the catch-all
const PAGE_TITLES: ReadonlyArray<readonly [string, string]> = [
  ['/dashboard/chemistry',      'Pool Chemistry'],
  ['/dashboard/tasks',          'Task Board'],
  ['/dashboard/ops-log',        'Ops Log'],
  ['/dashboard/dept-plan',      'Department Plan'],
  ['/dashboard/scores',         'Site Scores'],
  ['/dashboard/incidents',      'Incidents'],
  ['/dashboard/handovers',      'Handovers'],
  ['/dashboard/admin/users',    'Users'],
  ['/dashboard/admin/settings', 'Settings'],
  ['/dashboard',                'Overview'],
]

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname()
  const title = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'LeisureWorld'

  return (
    <header className="surface-glass hairline-b flex h-14 shrink-0 items-center gap-2 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <h2 className="text-subhead text-white/70">{title}</h2>
    </header>
  )
}
