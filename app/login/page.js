'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'
import { Loader2, Lock, Mail, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!json?.isAdmin) {
        await supabase.auth.signOut()
        setError('该账号没有管理员权限')
        return
      }
      router.push('/albums')
    } catch (e2) {
      setError(String(e2?.message || e2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-[440px] glass-panel rounded-3xl border border-white/10 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Shield size={18} className="text-accent" />
          </div>
          <div>
            <div className="text-white font-bold text-lg">专辑管理后台</div>
            <div className="text-secondary text-xs">管理员登录</div>
          </div>
        </div>

        {error ? (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        ) : null}

        <form onSubmit={handle} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-secondary">邮箱</label>
            <div className="flex items-center gap-2 h-11 px-3 rounded-2xl bg-black/20 border border-white/10">
              <Mail size={16} className="text-white/50" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent outline-none text-white text-sm"
                placeholder="you@example.com"
                type="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-secondary">密码</label>
            <div className="flex items-center gap-2 h-11 px-3 rounded-2xl bg-black/20 border border-white/10">
              <Lock size={16} className="text-white/50" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent outline-none text-white text-sm"
                placeholder="••••••••"
                type="password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full h-11 rounded-2xl bg-accent text-black font-bold hover:brightness-110 transition flex items-center justify-center gap-2',
              loading ? 'opacity-70 pointer-events-none' : ''
            )}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? '登录中' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}

