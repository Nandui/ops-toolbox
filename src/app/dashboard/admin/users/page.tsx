'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'
import { ROLE_LABELS } from '@/lib/portal'

interface UserInfo {
  id: number
  email: string
  name: string
  role: string
  site_ids: string
  active: number
  last_login_at: string | null
  created_at: string
}

export default function UsersPage() {
  const { user, isAdmin } = useAuth()
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/users')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setUsers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isAdmin])

  if (!user || !isAdmin) {
    return (
      <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-mono text-red-400">
        Access denied
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Admin console</div>
        <h1 className="text-3xl font-light text-white">User management</h1>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────────── */}
      {!loading && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Overview</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total users',  value: users.length },
              { label: 'Active',       value: users.filter(u => u.active).length },
              { label: 'Inactive',     value: users.filter(u => !u.active).length },
            ].map(({ label, value }) => (
              <article key={label} className="border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-2">{label}</div>
                <div className="font-mono text-3xl font-light text-white">{value}</div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ── Users table ────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Users</div>
        {loading ? (
          <div className="border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm font-mono text-slate-500">
            Loading…
          </div>
        ) : (
          <article className="border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {['Name', 'Email', 'Role', 'Status', 'Last login'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white text-sm">{u.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-[11px] font-mono">{u.email}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-slate-400">
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block border px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase whitespace-nowrap ${
                        u.active
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-white/10 bg-white/[0.03] text-slate-500'
                      }`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-slate-500">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-IE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </div>

    </div>
  )
}
