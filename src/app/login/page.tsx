'use client'

import { useState } from 'react'
import { Lock, Mail, Eye, EyeOff, Loader2, Zap, Waves } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bypassing, setBypassing] = useState(false)

  async function handleBypass() {
    setBypassing(true)
    try {
      const res = await fetch('/api/auth/bypass-login', { method: 'POST' })
      if (res.ok) {
        window.location.href = '/dashboard'
      } else {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'Bypass login failed')
        setBypassing(false)
      }
    } catch {
      setError('Network error')
      setBypassing(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }
      window.location.href = '/dashboard'
    } catch {
      setError('Network error. Retrying with standard login...')
      setLoading(false)
    }
  }

  let urlError = ''
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'missing') urlError = 'Email and password are required'
    if (params.get('error') === 'invalid') urlError = 'Invalid email or password'
    if (params.get('error') === 'server')  urlError = 'Server error. Please try again.'
  }

  const displayError = error || urlError

  const inputCls = 'w-full rounded-xl bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/25 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40'

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-3">

        {/* Brand */}
        <div className="flex items-center gap-3 px-1 pb-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <Waves className="size-4.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-subhead leading-tight text-white">LeisureWorld</p>
            <p className="text-caption text-white/40">Manager Portal</p>
          </div>
        </div>

        {/* Card */}
        <div className="surface-card p-6 space-y-5">
          <h1 className="text-title">Sign in</h1>

          {displayError && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-300 ring-1 ring-inset ring-red-500/20"
            >
              {displayError}
            </div>
          )}

          <form action="/api/auth/login" method="POST" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-caption text-white/50">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/25" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={`${inputCls} pl-10`}
                  placeholder="you@leisureworld.ie"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-caption text-white/50">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/25" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={`${inputCls} pl-10 pr-11`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/30 hover:text-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[15px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_1px_2px_rgb(0_0_0/0.3)] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 transition-all focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              {loading ? <><Loader2 className="size-4 animate-spin" />Signing in…</> : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Bypass */}
        <button
          onClick={handleBypass}
          disabled={bypassing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-4 py-3 text-[13px] text-white/40 hover:bg-white/[0.07] hover:text-white/60 disabled:opacity-50 transition-colors ring-[0.5px] ring-inset ring-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {bypassing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          Dev login
        </button>

      </div>
    </div>
  )
}
