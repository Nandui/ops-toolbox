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

  const notionConfigured = settings.find(s => s.key === 'notion_api_key')?.configured ?? false

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
    return (
      <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-mono text-red-400">
        Access denied
      </div>
    )
  }

  const displaySettings = settings.filter(s => s.key !== 'notion_api_key')

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Admin console</div>
        <h1 className="text-3xl font-light text-white">Settings</h1>
      </div>

      {/* ── Notion Integration ─────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Notion integration</div>
        <article className="border border-white/[0.08] bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs text-slate-500 max-w-lg">
              Used for the incidents database. Create an Internal Integration Token in your Notion workspace settings.
            </p>
            {notionConfigured && (
              <span className="shrink-0 flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />Configured
              </span>
            )}
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">
              {notionConfigured ? 'Replace API key' : 'API key'}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={notionKey}
                  onChange={e => { setNotionKey(e.target.value); setNotionStatus('idle') }}
                  placeholder={notionConfigured ? 'Enter new key to replace existing' : 'secret_…'}
                  className="w-full border border-white/10 bg-slate-900/80 px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 font-mono focus:outline-none focus:border-white/20"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={saveNotionKey}
                disabled={savingNotion || !notionKey.trim()}
                className="flex items-center gap-2 border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-mono text-slate-200 hover:bg-white/[0.08] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {savingNotion && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>

          {notionStatus === 'saved' && (
            <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />API key saved.
            </p>
          )}
          {notionStatus === 'error' && (
            <p className="text-[11px] font-mono text-red-400">{notionError}</p>
          )}
        </article>
      </div>

      {/* ── Trail API ──────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Trail API connection</div>
        <article className="border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[11px] font-mono">
            {[
              { label: 'Base URL',  value: 'https://web.trailapp.com/api/public' },
              { label: 'API key',   value: '••••••••••••' },
              { label: 'Sites',     value: SITES.map(s => s.name).join(', ') },
              { label: 'Cache TTL', value: '5 min (chemistry/tasks) · 60 min (scores)' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-slate-500 mb-0.5">{label}</div>
                <div className="text-slate-300">{value}</div>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* ── System settings ────────────────────────────────────────────────────── */}
      {!loading && displaySettings.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">System settings</div>
          <article className="border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left px-4 py-2.5 text-slate-500 font-normal tracking-wider uppercase text-[10px]">Key</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-normal tracking-wider uppercase text-[10px]">Value</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-normal tracking-wider uppercase text-[10px]">Updated</th>
                </tr>
              </thead>
              <tbody>
                {displaySettings.map(s => (
                  <tr key={s.key} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-2.5 text-slate-300">{s.key}</td>
                    <td className="px-4 py-2.5 text-slate-400">{s.value}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.updated_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      )}

    </div>
  )
}
