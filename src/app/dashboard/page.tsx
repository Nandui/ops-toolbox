'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'
import { FlaskConical, CheckSquare, BarChart3, AlertTriangle, ClipboardList, ArrowRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { SITES } from '@/lib/portal'

const NAV_CARDS = [
  { href: '/dashboard/chemistry',  label: 'Pool Chemistry', desc: 'Live chlorine, pH & temperature readings', icon: FlaskConical },
  { href: '/dashboard/tasks',      label: 'Task Board',     desc: 'Daily task completion status',            icon: CheckSquare  },
  { href: '/dashboard/scores',     label: 'Site Scores',    desc: 'Compliance & performance trends',         icon: BarChart3    },
  { href: '/dashboard/incidents',  label: 'Incidents',      desc: 'Incident & near-miss logs',               icon: AlertTriangle },
  { href: '/dashboard/handovers',  label: 'Handovers',      desc: 'Duty manager handover notes',             icon: ClipboardList },
] as const

export default function DashboardPage() {
  const { user } = useAuth()
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateStr(new Date().toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
  }, [])

  if (!user) return null

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Operations console</div>
        <h1 className="text-3xl font-light text-white">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate-500 font-mono">{dateStr || ' '}</p>
      </div>

      {/* ── Navigation grid ────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Modules</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {NAV_CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className="group block border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-white/[0.15] hover:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between mb-3">
                <card.icon className="w-4 h-4 text-slate-500 group-hover:text-slate-400 transition-colors" />
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
              <div className="text-sm font-medium text-white">{card.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{card.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Sites ──────────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Sites</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SITES.map(site => (
            <article key={site.id} className="border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 bg-emerald-400" />
                <span className="text-sm font-medium text-white">{site.name}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500">ID {site.id}</div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">{site.pools.join(' · ')}</div>
            </article>
          ))}
        </div>
      </div>

    </div>
  )
}
