'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'
import { ROLE_LABELS } from '@/lib/portal'
import { LoadingState } from '@/components/ui/loading-state'

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
      <div role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
        Access denied
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <h1 className="text-title">Users</h1>

      {/* ── KPI strip ──────────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Total users',  value: users.length },
            { label: 'Active',       value: users.filter(u => u.active).length },
            { label: 'Inactive',     value: users.filter(u => !u.active).length },
          ].map(({ label, value }) => (
            <article key={label} className="surface-card p-4">
              <div className="text-caption text-white/40">{label}</div>
              <div className="mt-1.5 font-mono text-3xl font-light text-white">{value}</div>
            </article>
          ))}
        </div>
      )}

      {/* ── Users table ────────────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingState label="Loading users…" />
      ) : (
        <article className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {['Name', 'Email', 'Role', 'Status', 'Last login'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/35">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm text-white">{u.name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-white/50">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-white/55">
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap ${
                        u.active
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-white/[0.08] text-white/45'
                      }`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-white/40">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-IE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

    </div>
  )
}
