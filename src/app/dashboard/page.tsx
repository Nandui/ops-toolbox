'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'
import {
  FlaskConical, CheckSquare, BarChart3, AlertTriangle,
  ClipboardList, ClipboardEdit, FileText, ArrowRight, Building2,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { SITES } from '@/lib/portal'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'

const MONITOR_CARDS = [
  { href: '/dashboard/chemistry', label: 'Pool Chemistry', desc: 'Chlorine, pH & temperature', icon: FlaskConical },
  { href: '/dashboard/tasks',     label: 'Task Board',    desc: 'Daily task completion',      icon: CheckSquare  },
  { href: '/dashboard/scores',    label: 'Site Scores',   desc: 'Compliance & performance',   icon: BarChart3    },
  { href: '/dashboard/incidents', label: 'Incidents',     desc: 'Incident & near-miss logs',  icon: AlertTriangle },
  { href: '/dashboard/handovers', label: 'Handovers',     desc: 'Duty manager handovers',     icon: ClipboardList },
] as const

export default function DashboardPage() {
  const { user } = useAuth()
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('en-IE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }))
  }, [])

  if (!user) return null

  const firstName = user.name.split(' ')[0]

  return (
    <div className="space-y-10">

      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle={dateStr || ' '}
      />

      {/* Daily workflow */}
      <section className="space-y-4">
        <SectionHeader title="Today's workflow" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <div className="surface-card flex flex-col gap-5 p-6 transition-transform duration-200 ease-out hover:-translate-y-0.5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
              <FileText className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="text-headline">Ops Log</h3>
              <p className="mt-1.5 text-callout text-white/50">
                Assign staff, record duties, and lock the day's operational record.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="self-start"
              render={<Link href="/dashboard/ops-log" />}
            >
              Open today's log
            </Button>
          </div>

          <div className="surface-card flex flex-col gap-5 p-6 transition-transform duration-200 ease-out hover:-translate-y-0.5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10">
              <ClipboardEdit className="size-6 text-emerald-400/60" />
            </div>
            <div>
              <h3 className="text-headline">Department Plan</h3>
              <p className="mt-1.5 text-callout text-white/50">
                Pre-plan staffing and bookings for your department. Pre-populates the Ops Log.
              </p>
            </div>
            <Button
              variant="secondary"
              size="lg"
              className="self-start"
              render={<Link href="/dashboard/dept-plan" />}
            >
              Plan the day
            </Button>
          </div>

        </div>
      </section>

      {/* Monitoring & reports */}
      <section className="space-y-4">
        <SectionHeader title="Monitoring & reports" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {MONITOR_CARDS.map((card, i) => (
            <Link
              key={card.href}
              href={card.href}
              className="surface-card group animate-page flex flex-col gap-3 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/[0.07]"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <card.icon className="size-5 text-white/30 transition-colors duration-150 group-hover:text-white/60" />
              <div className="flex-1">
                <div className="text-subhead">{card.label}</div>
                <div className="mt-0.5 text-caption text-white/40">{card.desc}</div>
              </div>
              <ArrowRight className="size-3.5 text-white/20 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-white/40" />
            </Link>
          ))}
        </div>
      </section>

      {/* Sites — quiet reference */}
      <section className="space-y-3">
        <SectionHeader title="Sites" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SITES.map(site => (
            <div
              key={site.id}
              className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-[0.5px] ring-inset ring-white/[0.06]"
            >
              <Building2 className="size-4 shrink-0 text-white/25" />
              <div className="min-w-0">
                <div className="text-subhead text-white/70">{site.name}</div>
                <div className="text-caption text-white/35">{site.pools.join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
