'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'
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

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-ring/40'
const labelCls = 'block text-[13px] font-medium text-white/60 mb-1.5'

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="surface-card animate-scale-in w-full max-w-lg space-y-5 rounded-2xl p-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-headline text-white">
            {isEdit ? `Edit ${editing!.name}` : 'Add user'}
          </h2>
          <button onClick={onClose} className="text-white/30 transition-colors hover:text-white/60">
            <X className="size-5" />
          </button>
        </div>

        {error && <StatusBanner variant="error" onDismiss={() => setError(null)}>{error}</StatusBanner>}

        {/* Name + Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Name <span className="text-red-400">*</span></label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name" className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Email <span className="text-red-400">*</span></label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="user@leisureworld.ie" className={inputCls}
            />
          </div>
        </div>

        {/* Role */}
        <div>
          <label className={labelCls}>Role <span className="text-red-400">*</span></label>
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
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/10 bg-white/[0.04] text-white/55 hover:text-white/80'
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
              {!isEdit && <span className="text-red-400"> *</span>}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Confirm password{!isEdit && <span className="text-red-400"> *</span>}
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
          <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3 ring-[0.5px] ring-inset ring-white/[0.06]">
            <div>
              <p className="text-sm font-medium text-white">Account active</p>
              <p className="mt-0.5 text-xs text-white/40">Inactive users cannot sign in</p>
            </div>
            <button
              type="button"
              onClick={() => setActive(v => !v)}
              role="switch"
              aria-checked={active}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                active ? 'bg-emerald-500' : 'bg-white/15'
              }`}
            >
              <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform duration-200 ${
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
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user, isAdmin } = useAuth()
  const [users, setUsers]   = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState<'add' | UserInfo | null>(null)
  const [toast, setToast]   = useState<string | null>(null)

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
          <p className="mt-1 text-[13px] text-white/40">Manage portal accounts and permissions.</p>
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
              <div className="text-caption text-white/40">{label}</div>
              <div className="mt-1.5 font-mono text-3xl font-light text-white">{value}</div>
            </article>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingState label="Loading users…" />
      ) : (
        <article className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {['Name', 'Email', 'Role', 'Sites', 'Status', 'Last login', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/35"
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
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-white/50">{u.email}</td>
                      <td className="px-4 py-3 text-xs text-white/55">
                        {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}
                      </td>
                      <td className="px-4 py-3 text-xs text-white/40">
                        {isAllSites ? (
                          <span className="text-emerald-400/60">All sites</span>
                        ) : siteNames ? (
                          siteNames
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
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
                      <td className="px-4 py-3 font-mono text-xs text-white/40">
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
