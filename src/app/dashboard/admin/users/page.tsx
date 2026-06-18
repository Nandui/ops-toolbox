'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { USER_ROLES, ROLE_LABELS, SITES } from '@/lib/portal'
import { LoadingState } from '@/components/ui/loading-state'
import { Button } from '@/components/ui/button'
import { StatusBanner } from '@/components/ui/status-banner'
import { Plus, X, Eye, EyeOff } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-xl border border-border bg-muted/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/40'
const labelCls = 'block text-[13px] font-medium text-muted-foreground mb-1.5'

// ── User Modal ─────────────────────────────────────────────────────────────────

function UserModal({
  editing,
  onClose,
  onSaved,
}: {
  editing?: UserInfo
  onClose: () => void
  onSaved: (u: UserInfo) => void
}) {
  const isEdit = !!editing

  const [name, setName]         = useState(editing?.name  ?? '')
  const [email, setEmail]       = useState(editing?.email ?? '')
  const [role, setRole]         = useState(editing?.role  ?? 'manager')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [active, setActive]     = useState(isEdit ? !!editing!.active : true)
  const [siteIds, setSiteIds]   = useState<number[]>(() => {
    if (!editing?.site_ids) return []
    try { return JSON.parse(editing.site_ids) } catch { return [] }
  })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const needsSites = !['admin', 'operations_manager'].includes(role)

  function toggleSite(id: number) {
    setSiteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function save() {
    setError(null)
    if (!name.trim() || !email.trim() || !role) {
      setError('Name, email, and role are required.'); return
    }
    if (!isEdit && !password) {
      setError('Password is required for new users.'); return
    }
    if (password && password !== confirm) {
      setError('Passwords do not match.'); return
    }
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters.'); return
    }

    setSaving(true)
    const body: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      role,
      active,
      siteIds: needsSites ? siteIds : [],
    }
    if (password) body.password = password

    const res = await fetch(
      isEdit ? `/api/admin/users/${editing!.id}` : '/api/admin/users',
      { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); setSaving(false); return }
    onSaved(data as UserInfo)
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div
        className="flex min-h-full items-end justify-center p-4 sm:items-center"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div className="surface-elevated animate-scale-in w-full max-w-lg space-y-5 rounded-2xl p-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-headline text-foreground">
            {isEdit ? `Edit ${editing!.name}` : 'Add user'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground/70 transition-colors hover:text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        {error && <StatusBanner variant="error" onDismiss={() => setError(null)}>{error}</StatusBanner>}

        {/* Name + Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Name <span className="text-destructive">*</span></label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name" className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Email <span className="text-destructive">*</span></label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="user@leisureworld.ie" className={inputCls}
            />
          </div>
        </div>

        {/* Role */}
        <div>
          <label className={labelCls}>Role <span className="text-destructive">*</span></label>
          <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
            {USER_ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        {/* Site access */}
        {needsSites && (
          <div>
            <label className={labelCls}>Site access</label>
            <div className="grid grid-cols-3 gap-2">
              {SITES.map(site => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => toggleSite(site.id)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    siteIds.includes(site.id)
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Password */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              {isEdit ? 'New password' : 'Password'}
              {!isEdit && <span className="text-destructive"> *</span>}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isEdit ? 'Leave blank to keep' : 'Min. 8 characters'}
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Confirm password{!isEdit && <span className="text-destructive"> *</span>}
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className={inputCls}
            />
          </div>
        </div>

        {/* Active toggle — edit only */}
        {isEdit && (
          <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 ring-[0.5px] ring-inset ring-border">
            <div>
              <p className="text-sm font-medium text-foreground">Account active</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Inactive users cannot sign in</p>
            </div>
            <button
              type="button"
              onClick={() => setActive(v => !v)}
              role="switch"
              aria-checked={active}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                active ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span className={`inline-block size-4 rounded-full bg-background shadow transition-transform duration-200 ${
                active ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </div>

        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user, isAdmin } = useAuth()
  const [users, setUsers]   = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modal, setModal]   = useState<'add' | UserInfo | null>(null)
  const [toast, setToast]   = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    try {
      const res = await fetch('/api/admin/users', { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Timed out loading users. The server took too long to respond.'
          : err instanceof Error ? err.message : 'Could not load users.'
      )
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    void loadUsers()
  }, [isAdmin, loadUsers])

  if (!user || !isAdmin) {
    return (
      <div role="alert" className="rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive ring-1 ring-inset ring-destructive/20">
        Access denied
      </div>
    )
  }

  function handleSaved(saved: UserInfo) {
    setUsers(prev =>
      modal === 'add'
        ? [saved, ...prev]
        : prev.map(u => u.id === saved.id ? saved : u)
    )
    setToast(modal === 'add' ? `${saved.name} created successfully.` : `${saved.name} updated.`)
    setModal(null)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title">Users</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Manage portal accounts and permissions.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setModal('add')}>
          <Plus className="size-3.5" />
          Add user
        </Button>
      </div>

      {toast && (
        <StatusBanner variant="success" onDismiss={() => setToast(null)}>{toast}</StatusBanner>
      )}

      {/* KPI strip */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total',    value: users.length                          },
            { label: 'Active',   value: users.filter(u => u.active).length   },
            { label: 'Inactive', value: users.filter(u => !u.active).length  },
          ].map(({ label, value }) => (
            <article key={label} className="surface-card p-4">
              <div className="text-caption text-muted-foreground">{label}</div>
              <div className="mt-1.5 font-mono text-3xl font-light text-foreground">{value}</div>
            </article>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingState label="Loading users…" />
      ) : loadError ? (
        <div className="surface-card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="tertiary" size="sm" onClick={() => void loadUsers()}>
            Try again
          </Button>
        </div>
      ) : (
        <article className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Name', 'Email', 'Role', 'Sites', 'Status', 'Last login', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  let parsedSites: number[] = []
                  try { parsedSites = JSON.parse(u.site_ids) } catch { /* empty */ }
                  const siteNames = parsedSites.length
                    ? SITES.filter(s => parsedSites.includes(s.id)).map(s => s.name).join(', ')
                    : null
                  const isAllSites = ['admin', 'operations_manager'].includes(u.role)

                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {isAllSites ? (
                          <span className="text-primary">All sites</span>
                        ) : siteNames ? (
                          siteNames
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={
                          u.active
                            ? 'pill-base pill-ok'
                            : 'pill-base pill-neutral'
                        }>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-IE') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="xs" onClick={() => setModal(u)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Modal */}
      {modal !== null && (
        <UserModal
          editing={modal === 'add' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

    </div>
  )
}
