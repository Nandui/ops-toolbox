'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'
import { FlaskConical, CheckSquare, BarChart3, AlertTriangle, ClipboardList, ArrowRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { SITES } from '@/lib/portal'

const NAV_CARDS = [
  { href: '/dashboard/chemistry', label: 'Pool Chemistry', desc: 'Live chlorine, pH & temperature readings', icon: FlaskConical, color: 'emerald' },
  { href: '/dashboard/tasks', label: 'Task Board', desc: 'Daily task completion status', icon: CheckSquare, color: 'blue' },
  { href: '/dashboard/scores', label: 'Site Scores', desc: 'Compliance & performance trends', icon: BarChart3, color: 'amber' },
  { href: '/dashboard/incidents', label: 'Incidents', desc: 'Incident & near-miss logs', icon: AlertTriangle, color: 'red' },
  { href: '/dashboard/handovers', desc: 'Duty manager handover notes', label: 'Handovers', icon: ClipboardList, color: 'purple' },
] as const

const COLOR_MAP: Record<string, { bg: string; border: string; icon: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400' },
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [dateStr, setDateStr] = useState('')

  // Render date client-side only to avoid hydration mismatch
  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
  }, [])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-black/20 backdrop-blur-xl ring-1 ring-white/5">
        <h1 className="text-2xl font-bold text-white">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-slate-300">{dateStr || '\u00A0'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {NAV_CARDS.map(card => {
          const colors = COLOR_MAP[card.color]
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group block rounded-2xl border border-white/10 bg-slate-900/78 p-5 transition-all hover:border-white/20 hover:bg-slate-800/90 hover:shadow-lg hover:shadow-black/20 ring-1 ring-white/5"
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${colors.icon}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 transition-colors group-hover:text-slate-200" />
              </div>
              <h3 className="text-white font-semibold mt-3">{card.label}</h3>
              <p className="mt-1 text-sm text-slate-400">{card.desc}</p>
            </Link>
          )
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/78 p-5 ring-1 ring-white/5">
        <h2 className="text-lg font-semibold text-white mb-4">Sites</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SITES.map(site => (
            <div key={site.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-white font-medium">{site.name}</span>
              </div>
              <p className="text-slate-400 text-xs mt-2">Site ID: {site.id}</p>
              <p className="text-slate-500 text-xs mt-1">Pools: {site.pools.join(', ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}