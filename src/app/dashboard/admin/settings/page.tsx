'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'
import { SITES } from '@/lib/portal'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout, loadErrorMessage } from '@/lib/fetch'
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
  const [loadError, setLoadError] = useState<string | null>(null)

  const [notionKey, setNotionKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingNotion, setSavingNotion] = useState(false)
  const [notionStatus, setNotionStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [notionError, setNotionError] = useState<string | null>(null)

  function loadSettings() {
    setLoading(true)
    setLoadError(null)
    fetchWithTimeout('/api/admin/settings')
      .then(r => r.ok ? r.json() : [])
      .then((data: Setting[]) => { setSettings(data); setLoading(false) })
      .catch(err => { setLoadError(loadErrorMessage(err)); setLoading(false) })
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
      <div role="alert" className="rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive ring-1 ring-inset ring-destructive/20">
        Access denied
      </div>
    )
  }

  const displaySettings = settings.filter(s => s.key !== 'notion_api_key')

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <h1 className="text-title">Settings</h1>

      {loadError && (
        <div className="surface-card space-y-3 p-5">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="tertiary" size="sm" onClick={() => loadSettings()}>Try again</Button>
        </div>
      )}

      {/* ── Notion Integration ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-headline text-foreground">Notion integration</h2>
        <article className="surface-card space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="max-w-lg text-callout text-muted-foreground">
              Used for the incidents database. Create an Internal Integration Token in your Notion workspace settings.
            </p>
            {notionConfigured && (
              <span className="pill-base pill-ok shrink-0">
                <CheckCircle2 className="size-3" />Configured
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="notion-key" className="block text-caption text-muted-foreground">
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
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 pr-11 text-sm text-foreground font-mono placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  aria-pressed={showKey}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground/70 hover:text-muted-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <button
                onClick={saveNotionKey}
                disabled={savingNotion || !notionKey.trim()}
                className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {savingNotion && <RefreshCw className="size-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>

          {notionStatus === 'saved' && (
            <p role="status" className="flex items-center gap-1.5 text-[13px] text-success">
              <CheckCircle2 className="size-3.5" />API key saved.
            </p>
          )}
          {notionStatus === 'error' && (
            <p role="alert" className="text-[13px] text-destructive">{notionError}</p>
          )}
        </article>
      </div>

      {/* ── Trail API ──────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-headline text-foreground">Trail API connection</h2>
        <article className="surface-card p-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              { label: 'Base URL',  value: 'https://web.trailapp.com/api/public' },
              { label: 'API key',   value: '••••••••••••' },
              { label: 'Sites',     value: SITES.map(s => s.name).join(', ') },
              { label: 'Cache TTL', value: '5 min (chemistry/tasks) · 60 min (scores)' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="mb-0.5 text-caption text-muted-foreground">{label}</div>
                <div className="text-[13px] font-mono text-muted-foreground">{value}</div>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* ── System settings ────────────────────────────────────────────────────── */}
      {!loading && displaySettings.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-headline text-foreground">System settings</h2>
          <article className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-[13px] font-mono">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Key</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Value</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {displaySettings.map(s => (
                    <tr key={s.key} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-foreground">{s.key}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.value}</td>
                      <td className="px-4 py-2.5 text-muted-foreground/70">{s.updated_at}</td>
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
