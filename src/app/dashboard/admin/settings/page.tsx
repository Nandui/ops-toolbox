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
      <div role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
        Access denied
      </div>
    )
  }

  const displaySettings = settings.filter(s => s.key !== 'notion_api_key')

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <h1 className="text-title">Settings</h1>

      {/* ── Notion Integration ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-headline text-white/80">Notion integration</h2>
        <article className="surface-card space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="max-w-lg text-callout text-white/45">
              Used for the incidents database. Create an Internal Integration Token in your Notion workspace settings.
            </p>
            {notionConfigured && (
              <span className="flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 text-[12px] font-medium text-emerald-300">
                <CheckCircle2 className="size-3" />Configured
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="notion-key" className="block text-caption text-white/50">
              {notionConfigured ? 'Replace API key' : 'API key'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="notion-key"
                  type={showKey ? 'text' : 'password'}
                  value={notionKey}
                  onChange={e => { setNotionKey(e.target.value); setNotionStatus('idle') }}
                  placeholder={notionConfigured ? 'Enter new key to replace existing' : 'secret_…'}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 pr-11 text-sm text-white font-mono placeholder:text-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  aria-pressed={showKey}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/30 hover:text-white/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <button
                onClick={saveNotionKey}
                disabled={savingNotion || !notionKey.trim()}
                className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2 text-sm text-white/70 hover:bg-white/[0.09] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {savingNotion && <RefreshCw className="size-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>

          {notionStatus === 'saved' && (
            <p role="status" className="flex items-center gap-1.5 text-[13px] text-emerald-300">
              <CheckCircle2 className="size-3.5" />API key saved.
            </p>
          )}
          {notionStatus === 'error' && (
            <p role="alert" className="text-[13px] text-red-300">{notionError}</p>
          )}
        </article>
      </div>

      {/* ── Trail API ──────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-headline text-white/80">Trail API connection</h2>
        <article className="surface-card p-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              { label: 'Base URL',  value: 'https://web.trailapp.com/api/public' },
              { label: 'API key',   value: '••••••••••••' },
              { label: 'Sites',     value: SITES.map(s => s.name).join(', ') },
              { label: 'Cache TTL', value: '5 min (chemistry/tasks) · 60 min (scores)' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="mb-0.5 text-caption text-white/40">{label}</div>
                <div className="text-[13px] font-mono text-white/70">{value}</div>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* ── System settings ────────────────────────────────────────────────────── */}
      {!loading && displaySettings.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-headline text-white/80">System settings</h2>
          <article className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-[13px] font-mono">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/35">Key</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/35">Value</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/35">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {displaySettings.map(s => (
                    <tr key={s.key} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-2.5 text-white/70">{s.key}</td>
                      <td className="px-4 py-2.5 text-white/50">{s.value}</td>
                      <td className="px-4 py-2.5 text-white/30">{s.updated_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

    </div>
  )
}
