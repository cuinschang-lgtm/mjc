'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  const returnTo = searchParams?.get('returnTo') || '/'

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push(returnTo)
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        // For signup, usually need to verify email, but we'll redirect to show message or auto-login if configured
        alert(t('auth.checkEmailDesc'))
        // Optionally switch to login mode or redirect
        setIsLogin(true)
      }
    } catch (err) {
      setError(t('auth.error') + ': ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center -ml-72 w-[calc(100vw)] bg-background relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-accent/10 rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-accent-dark/20 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.05] mix-blend-overlay" />
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 p-8 z-10 items-center">
        {/* Left Column: Hero Text */}
        <div className="hidden lg:flex flex-col justify-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 w-fit backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-medium text-white/80 tracking-wide">100% Offline Music Player</span>
          </div>
          
          <h1 className="text-6xl font-bold text-white leading-tight">
            Your <span className="text-accent">Music</span><br />
            Your Way<br />
            Anywhere
          </h1>
          
          <p className="text-lg text-secondary max-w-md leading-relaxed">
            Experience the freedom of offline music playback. No internet? No problem. Enjoy your favorite songs anytime, anywhere with Pickup.
          </p>

          <div className="flex gap-4">
            <button className="btn-primary px-8 py-3 rounded-full font-bold shadow-neon hover:shadow-[0_0_30px_rgba(255,77,77,0.6)] transition-all transform hover:-translate-y-1">
              Get Started
            </button>
            <button className="btn-secondary px-8 py-3 rounded-full font-bold">
              Learn More
            </button>
          </div>
          
          <div className="flex items-center gap-4 pt-4">
             <div className="flex -space-x-3">
               {[1,2,3,4].map(i => (
                 <div key={i} className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-background flex items-center justify-center text-xs text-white/50">
                   User
                 </div>
               ))}
             </div>
             <div className="flex flex-col">
               <span className="text-white font-bold">1000+ users</span>
               <div className="flex text-accent text-xs">★★★★★</div>
             </div>
          </div>
        </div>

        {/* Right Column: Login Form */}
        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md glass-panel p-8 md:p-10 rounded-3xl border border-white/10 relative shadow-2xl backdrop-blur-xl">
            {/* Glow behind card */}
            <div className="absolute -inset-1 bg-gradient-to-r from-accent to-orange-600 rounded-3xl opacity-20 blur-xl -z-10" />
            
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                {isLogin ? t('auth.welcome') : 'Join Pickup'}
              </h2>
              <p className="text-secondary text-sm font-medium">
                {isLogin ? t('auth.signInDesc') : 'Create your account to start collecting'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-wider ml-1">{t('auth.emailLabel')}</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-3.5 text-secondary group-focus-within:text-accent transition-colors" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-300"
                    placeholder={t('auth.emailPlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-secondary uppercase tracking-wider ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-3.5 text-secondary group-focus-within:text-accent transition-colors" size={20} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-300"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                   {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-4 rounded-xl text-lg font-bold shadow-neon hover:shadow-[0_0_25px_rgba(255,77,77,0.5)] transition-all flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {isLogin ? t('sidebar.signIn') : 'Create Account'}
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsLogin(!isLogin);
                }}
                className="text-sm font-medium text-secondary hover:text-white transition-colors"
              >
                {isLogin ? (
                  <>Don’t have an account? <span className="text-accent hover:underline">Sign up</span></>
                ) : (
                  <>Already have an account? <span className="text-accent hover:underline">Sign in</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
