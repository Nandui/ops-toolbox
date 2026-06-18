'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'
import {
  FlaskConical, CheckSquare, BarChart3, AlertTriangle, ShieldCheck,
  ClipboardList, ClipboardEdit, FileText, ArrowRight, Building2,
  CalendarClock, ChevronRight, Gauge,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { SITES } from '@/lib/portal'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { StatusPill, inferTone } from '@/components/ui/status-pill'

const MONITOR_CARDS = [
  { href: '/dashboard/chemistry',  label: 'Pool Chemistry', desc: 'Chlorine, pH & temperature', icon: FlaskConical },
  { href: '/dashboard/plant-room', label: 'Plant Room',     desc: 'Chlorine stock levels',      icon: Gauge        },
  { href: '/dashboard/tasks',      label: 'Task Board',     desc: 'Daily task completion',      icon: CheckSquare  },
  { href: '/dashboard/scores',     label: 'Site Scores',    desc: 'Compliance & performance',   icon: BarChart3    },
  { href: '/dashboard/incidents',  label: 'Incidents',      desc: 'Incident & near-miss logs',  icon: AlertTriangle },
  { href: '/dashboard/handovers',  label: 'Handovers',      desc: 'Duty manager handovers',     icon: ClipboardList },
] as const

// ── Risk data (the one aggregate source wired up) ────────────────────────────

interface RiskAssessment {
  pageId: string; url: string; title: string; status: string | null
  complete: boolean; risk: string | null; site: string | null
  category: string | null; owner: string | null
  reviewDate: string | null; reviewOverdue: boolean; lastEdited: string
}

function isHighRisk(r: RiskAssessment) {
  return /critical|extreme|severe|very high|high|major/i.test(r.risk || '')
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-IE', { day: '2-digit', month: 'short' })
}

// ── KPI tile ─────────────────────────────────────────────────────────────────

function AttentionTile({
  icon: Icon, label, value, hint, href, tone,
}: {
  icon: React.ElementType
  label: string
  value: number
  hint: string
  href: string
  tone: 'critical' | 'warning' | 'ok'
}) {
  const accent =
    value === 0 ? 'text-success'
    : tone === 'critical' ? 'text-destructive'
    : tone === 'warning' ? 'text-warning'
    : 'text-success'
  const iconWrap =
    value === 0 ? 'bg-success/10 text-success'
    : tone === 'critical' ? 'bg-destructive/10 text-destructive'
    : tone === 'warning' ? 'bg-warning/10 text-warning'
    : 'bg-success/10 text-success'

  return (
    <Link
      href={href}
      className="surface-card group flex items-center gap-4 p-4 transition-shadow hover:shadow-[0_4px_16px_rgb(2_6_23/0.08)]"
    >
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-2xl leading-none font-medium ${accent}`}>{value}</span>
          <span className="text-subhead text-foreground">{label}</span>
        </div>
        <p className="mt-1 truncate text-caption text-muted-foreground">{hint}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [dateStr, setDateStr] = useState('')
  const [risks, setRisks] = useState<RiskAssessment[]>([])
  const [risksLoaded, setRisksLoaded] = useState(false)

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('en-IE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }))
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/notion/risk-assessments', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { if (active) { setRisks(d.assessments || []); setRisksLoaded(true) } })
      .catch(() => { if (active) setRisksLoaded(true) })
    return () => { active = false }
  }, [])

  if (!user) return null

  const firstName = user.name.split(' ')[0]

  const overdue     = risks.filter(r => r.reviewOverdue)
  const highRisk    = risks.filter(r => !r.complete && isHighRisk(r))
  const outstanding = risks.filter(r => !r.complete)

  // Action list — overdue and high-risk first, capped.
  const actionItems = [...risks]
    .filter(r => r.reviewOverdue || (!r.complete && isHighRisk(r)))
    .sort((a, b) => {
      if (a.reviewOverdue !== b.reviewOverdue) return a.reviewOverdue ? -1 : 1
      return (isHighRisk(b) ? 1 : 0) - (isHighRisk(a) ? 1 : 0)
    })
    .slice(0, 6)

  return (
    <div className="space-y-9">

      <PageHeader title={`Welcome back, ${firstName}`} subtitle={dateStr || ' '} />

      {/* Needs attention — the action-focused core of the dashboard */}
      <section className="space-y-4">
        <SectionHeader
          title="Needs attention"
          action={
            <Button variant="ghost" size="sm" render={<Link href="/dashboard/risk-assessments" />}>
              Risk register <ArrowRight className="size-3.5" />
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AttentionTile
            icon={CalendarClock} label="Reviews overdue" value={overdue.length}
            hint={overdue.length ? 'Risk assessments past review date' : 'All reviews in date'}
            href="/dashboard/risk-assessments" tone="critical"
          />
          <AttentionTile
            icon={ShieldCheck} label="High / critical" value={highRisk.length}
            hint={highRisk.length ? 'Open high-risk assessments' : 'No open high risks'}
            href="/dashboard/risk-assessments" tone="warning"
          />
          <AttentionTile
            icon={AlertTriangle} label="Outstanding" value={outstanding.length}
            hint={outstanding.length ? 'Assessments not yet complete' : 'Register complete'}
            href="/dashboard/risk-assessments" tone="warning"
          />
        </div>

        {/* Action list */}
        <div className="surface-card overflow-hidden p-0">
          {!risksLoaded ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : actionItems.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-6 text-callout text-muted-foreground">
              <ShieldCheck className="size-4 text-success" />
              Nothing needs attention right now — no overdue reviews or open high-risk items.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {actionItems.map(r => (
                <li key={r.pageId}>
                  <Link
                    href="/dashboard/risk-assessments"
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className={`size-1.5 shrink-0 rounded-full ${r.reviewOverdue ? 'bg-destructive' : 'bg-warning'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-callout font-medium text-foreground">{r.title}</p>
                      <p className="truncate text-caption text-muted-foreground">
                        {[r.category, r.site].filter(Boolean).join(' · ') || 'Uncategorised'}
                        {r.reviewOverdue && r.reviewDate ? ` · review due ${formatDate(r.reviewDate)}` : ''}
                      </p>
                    </div>
                    {r.risk && <StatusPill label={r.risk} tone={inferTone(r.risk)} />}
                    {r.reviewOverdue && <StatusPill label="Overdue" tone="critical" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Daily workflow */}
      <section className="space-y-4">
        <SectionHeader title="Today's workflow" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <div className="surface-card flex flex-col gap-5 p-6 transition-shadow hover:shadow-[0_4px_16px_rgb(2_6_23/0.08)]">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="text-headline text-foreground">Ops Log</h3>
              <p className="mt-1.5 text-callout text-muted-foreground">
                Assign staff, record duties, and lock the day&apos;s operational record.
              </p>
            </div>
            <Button variant="primary" size="lg" className="self-start" render={<Link href="/dashboard/ops-log" />}>
              Open today&apos;s log
            </Button>
          </div>

          <div className="surface-card flex flex-col gap-5 p-6 transition-shadow hover:shadow-[0_4px_16px_rgb(2_6_23/0.08)]">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <ClipboardEdit className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="text-headline text-foreground">Department Plan</h3>
              <p className="mt-1.5 text-callout text-muted-foreground">
                Pre-plan staffing and bookings for your department. Pre-populates the Ops Log.
              </p>
            </div>
            <Button variant="secondary" size="lg" className="self-start" render={<Link href="/dashboard/dept-plan" />}>
              Plan the day
            </Button>
          </div>

        </div>
      </section>

      {/* Monitoring & reports */}
      <section className="space-y-4">
        <SectionHeader title="Monitoring & reports" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {MONITOR_CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className="surface-card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-[0_4px_16px_rgb(2_6_23/0.08)]"
            >
              <card.icon className="size-5 text-muted-foreground/70 transition-colors group-hover:text-primary" />
              <div className="flex-1">
                <div className="text-subhead text-foreground">{card.label}</div>
                <div className="mt-0.5 text-caption text-muted-foreground">{card.desc}</div>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      {/* Sites — quiet reference */}
      <section className="space-y-3">
        <SectionHeader title="Sites" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SITES.map(site => (
            <div key={site.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <Building2 className="size-4 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0">
                <div className="text-subhead text-foreground">{site.name}</div>
                <div className="text-caption text-muted-foreground">{site.pools.join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
