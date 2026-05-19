'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'
import { ROLE_LABELS } from '@/lib/portal'

interface UserInfo {
  id: number; email: string; name: string; role: string
  site_ids: string; active: number; last_login_at: string | null; created_at: string
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
    return <div className="text-center py-12 text-red-400">Access denied</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-zinc-400 mt-1">Manage portal users and access levels</p>
      </div>
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading users...</div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-white">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-300">{u.email}</td>
                  <td className="px-4 py-3 text-zinc-300">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-700 text-zinc-400 border border-zinc-600'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-IE') : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}