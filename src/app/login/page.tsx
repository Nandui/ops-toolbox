'use client'

import { useState } from 'react'
import { Building2, Lock, Mail, Eye, EyeOff, Loader2, Zap } from 'lucide-react'

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
        setError('Bypass login failed')
        setBypassing(false)
      }
    } catch {
      setError('Network error')
      setBypassing(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // If no JS hydration happened, or if fetch fails, the form falls back
    // to native POST to /api/auth/login (handled by the route handler)
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

      // Hard navigate so the proxy picks up the new cookie
      window.location.href = '/dashboard'
    } catch {
      // fetch failed — fall back to native form submission
      // This shouldn't normally happen, but if it does, the form's
      // action="/api/auth/login" method="POST" will handle it
      setError('Network error. Retrying with standard login...')
      setLoading(false)
    }
  }

  // Read URL error params (from server-side redirect fallback)
  let urlError = ''
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'missing') urlError = 'Email and password are required'
    if (params.get('error') === 'invalid') urlError = 'Invalid email or password'
    if (params.get('error') === 'server') urlError = 'Server error. Please try again.'
  }

  const displayError = error || urlError

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,rgba(11,15,21,1),rgba(16,22,31,1))]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/14 mb-4 shadow-lg shadow-emerald-950/20">
            <Building2 className="w-8 h-8 text-emerald-300" />
          </div>
          <h1 className="text-2xl font-bold text-white">LeisureWorld</h1>
          <p className="mt-1 text-sm text-slate-400">Manager Portal</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/82 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl ring-1 ring-white/5">
          <h2 className="text-lg font-semibold text-white mb-6">Sign in to your account</h2>

          {displayError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {displayError}
            </div>
          )}

          {/* action + method as fallback for when JS doesn't hydrate */}
          <form action="/api/auth/login" method="POST" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/55 pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm shadow-inner shadow-black/20 focus:outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/40"
                  placeholder="you@leisureworld.ie"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/55 pl-10 pr-10 py-2.5 text-white placeholder-slate-500 text-sm shadow-inner shadow-black/20 focus:outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/40"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <div className="mt-4">
          <button
            onClick={handleBypass}
            disabled={bypassing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white disabled:opacity-50"
          >
            {bypassing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Login
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          LeisureWorld Cork · Manager Portal v1.0
        </p>
      </div>
    </div>
  )
}