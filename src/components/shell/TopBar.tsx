'use client'

import { usePathname } from 'next/navigation'
import { Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Longest-prefix match first; '/dashboard' last as the catch-all
const PAGE_TITLES: ReadonlyArray<readonly [string, string]> = [
  ['/dashboard/chemistry',         'Pool Chemistry'],
  ['/dashboard/plant-room',        'Plant Room'],
  ['/dashboard/tasks',             'Task Board'],
  ['/dashboard/ops-log',           'Ops Log'],
  ['/dashboard/dept-plan',         'Department Plan'],
  ['/dashboard/scores',            'Site Scores'],
  ['/dashboard/incidents',         'Incidents'],
  ['/dashboard/risk-assessments',  'Risk Assessments'],
  ['/dashboard/handovers',         'Handovers'],
  ['/dashboard/purchase-orders',   'Purchase Orders'],
  ['/dashboard/admin/users',       'Users'],
  ['/dashboard/admin/settings',    'Settings'],
  ['/dashboard',                   'Overview'],
]

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname()
  const title = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'LeisureWorld'

  return (
    <header className="surface-glass hairline-b sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <h2 className="text-headline text-foreground">{title}</h2>

      {/* Search — pushes actions to the right */}
      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search…"
            aria-label="Search"
            className="h-9 w-44 rounded-lg border border-input bg-card pr-3 pl-9 text-sm text-foreground transition-[border-color,box-shadow,width] outline-none placeholder:text-muted-foreground/60 focus-visible:w-60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 lg:w-56"
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="sm:hidden"
          aria-label="Search"
        >
          <Search />
        </Button>
      </div>
    </header>
  )
}
