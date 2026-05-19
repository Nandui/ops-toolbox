'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'
import { SITES } from '@/lib/portal'

interface Setting {
  key: string; value: string; updated_at: string
}

export default function SettingsPage() {
  const { user, isAdmin } = useAuth()
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/settings')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setSettings(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isAdmin])

  if (!user || !isAdmin) {
    return <div className="text-center py-12 text-red-400">Access denied</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Portal configuration</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading settings...</div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                <th className="text-left px-5 py-3 font-medium">Setting</th>
                <th className="text-left px-5 py-3 font-medium">Value</th>
                <th className="text-left px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {settings.map(s => (
                <tr key={s.key} className="border-b border-zinc-800/50">
                  <td className="px-5 py-3 text-sm text-white font-mono">{s.key}</td>
                  <td className="px-5 py-3 text-sm text-zinc-300 font-mono">{s.value}</td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{s.updated_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Trail API Connection</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Base URL</p>
            <p className="text-zinc-300 font-mono">https://web.trailapp.com/api/public</p>
          </div>
          <div>
            <p className="text-zinc-500">API Key</p>
            <p className="text-zinc-300 font-mono">••••••••••••</p>
          </div>
          <div>
            <p className="text-zinc-500">Sites</p>
            <p className="text-zinc-300">{SITES.map(site => site.name).join(', ')}</p>
          </div>
          <div>
            <p className="text-zinc-500">Cache TTL</p>
            <p className="text-zinc-300">5 min (chemistry/tasks), 60 min (scores)</p>
          </div>
        </div>
      </div>
    </div>
  )
}