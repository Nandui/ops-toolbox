'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'
import { SITES } from '@/lib/portal'
import { CheckCircle2, Eye, EyeOff, RefreshCw } from 'lucide-react'

interface Setting {
  key: string
  value: string
  updated_at: string
  configured?: boolean
}

export default function SettingsPage() {
  const { user, isAdmin } = useAuth()
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)

  // Notion key form state
  const [notionKey, setNotionKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingNotion, setSavingNotion] = useState(false)
  const [notionStatus, setNotionStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [notionError, setNotionError] = useState<string | null>(null)

  function loadSettings() {
    setLoading(true)
    fetch('/api/admin/settings')
      .then(r => r.ok ? r.json() : [])
      .then((data: Setting[]) => { setSettings(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (!isAdmin) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings()
  }, [isAdmin])

  const notionSetting = settings.find(s => s.key === 'notion_api_key')
  const notionConfigured = notionSetting?.configured ?? false

  async function saveNotionKey() {
    if (!notionKey.trim()) return
    setSavingNotion(true)
    setNotionStatus('idle')
    setNotionError(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'notion_api_key', value: notionKey.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Error ${res.status}`)
      }
      setNotionStatus('saved')
      setNotionKey('')
      loadSettings()
    } catch (err) {
      setNotionStatus('error')
      setNotionError(String(err))
    } finally {
      setSavingNotion(false)
    }
  }

  if (!user || !isAdmin) {
    return <div className="text-center py-12 text-red-400">Access denied</div>
  }

  const displaySettings = settings.filter(s => s.key !== 'notion_api_key')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Portal configuration</p>
      </div>

      {/* Notion Integration */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Notion Integration</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Used for the incidents database. Create an Internal Integration Token in your Notion workspace settings.
            </p>
          </div>
          {notionConfigured && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Configured
            </span>
          )}
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {notionConfigured ? 'Replace API key' : 'API key'}
            </span>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={notionKey}
                  onChange={e => { setNotionKey(e.target.value); setNotionStatus('idle') }}
                  placeholder={notionConfigured ? 'Enter new key to replace the existing one' : 'secret_…'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={saveNotionKey}
                disabled={savingNotion || !notionKey.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {savingNotion && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </label>

          {notionStatus === 'saved' && (
            <p className="text-sm text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> API key saved successfully.
            </p>
          )}
          {notionStatus === 'error' && (
            <p className="text-sm text-red-400">{notionError}</p>
          )}
        </div>
      </div>

      {/* Trail API info */}
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

      {/* System settings table */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading settings...</div>
      ) : displaySettings.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">System settings</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                <th className="text-left px-5 py-3 font-medium">Key</th>
                <th className="text-left px-5 py-3 font-medium">Value</th>
                <th className="text-left px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {displaySettings.map(s => (
                <tr key={s.key} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-5 py-3 text-sm text-white font-mono">{s.key}</td>
                  <td className="px-5 py-3 text-sm text-zinc-300 font-mono">{s.value}</td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{s.updated_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
