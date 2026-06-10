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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[linear-gradient(180deg,rgba(11,15,21,1),rgba(16,22,31,1))]">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center border border-emerald-400/25 bg-emerald-500/10">
            <Waves className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-white leading-tight">LeisureWorld</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500">Manager Portal</p>
          </div>
        </div>

        {/* Card */}
        <div className="border border-white/[0.08] bg-white/[0.03] p-6">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1">Access</div>
          <h1 className="text-2xl font-light text-white mb-6">Sign in</h1>

          {displayError && (
            <div className="mb-4 border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm font-mono text-red-400">
              {displayError}
            </div>
          )}

          <form action="/api/auth/login" method="POST" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full border border-white/10 bg-slate-950/60 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 font-mono focus:outline-none focus:border-white/20"
                  placeholder="you@leisureworld.ie"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-white/10 bg-slate-950/60 pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 font-mono focus:outline-none focus:border-white/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-mono text-emerald-300 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Bypass */}
        <div className="mt-2">
          <button
            onClick={handleBypass}
            disabled={bypassing}
            className="flex w-full items-center justify-center gap-2 border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-mono text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300 disabled:opacity-50"
          >
            {bypassing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Login
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] font-mono text-slate-600">
          LeisureWorld Cork · Manager Portal v1.0
        </p>
      </div>
    </div>
  )
}
