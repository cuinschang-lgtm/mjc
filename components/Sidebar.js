'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Library, Search, BarChart3, Settings, LogOut, Shield, User } from 'lucide-react'
import { supabase } from '@/lib/supabaseBrowser'
import { cn } from '../lib/utils'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

const Sidebar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [profile, setProfile] = useState(null)
  const { t } = useLanguage()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      if (session?.access_token) {
        try {
          const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
          const json = await res.json()
          setIsAdmin(!!json?.isAdmin)
        } catch {
          setIsAdmin(false)
        }

        try {
          const { data: p } = await supabase
            .from('profiles')
            .select('nickname,avatar_url,signature')
            .eq('user_id', session.user.id)
            .maybeSingle()
          setProfile(p || null)
        } catch {
          setProfile(null)
        }
      } else {
        setIsAdmin(false)
        setProfile(null)
      }
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.access_token) {
        fetch('/api/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
          .then((r) => r.json())
          .then((j) => setIsAdmin(!!j?.isAdmin))
          .catch(() => setIsAdmin(false))

        supabase
          .from('profiles')
          .select('nickname,avatar_url,signature')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data }) => setProfile(data || null))
          .catch(() => setProfile(null))
      } else {
        setIsAdmin(false)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const navItems = [
    { name: t('sidebar.myLibrary'), href: '/', icon: Library, tour: 'nav-library' },
    { name: t('sidebar.search'), href: '/search', icon: Search, tour: 'nav-search' },
    { name: t('sidebar.charts'), href: '/charts', icon: BarChart3 },
    ...(isAdmin ? [{ name: t('sidebar.adminAlbums'), href: '/albums', icon: Shield }] : []),
    { name: t('sidebar.personalCenter'), href: '/me', icon: User },
    { name: t('sidebar.settings'), href: '/settings', icon: Settings },
  ]

  if (!user && pathname === '/auth') return null

  // Ensure z-index is high and pointer-events are enabled
  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-background border-r border-white/5 flex flex-col p-8 z-[9999] pointer-events-auto">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          {t('common.appName')}<span className="text-accent">.</span>
        </h1>
        <p className="text-[10px] text-secondary/60 mt-2 tracking-[0.2em] uppercase font-medium">{t('common.personalLibrary')}</p>
      </div>

      <nav className="flex-1 space-y-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              data-tour={item.tour}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-full transition-all duration-300 group cursor-pointer relative overflow-hidden",
                isActive 
                  ? "text-white font-medium" 
                  : "text-secondary hover:text-white"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-transparent opacity-50 pointer-events-none" />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent rounded-r-full shadow-[0_0_10px_rgba(255,77,77,0.5)] pointer-events-none" />
              )}
              
              <Icon size={22} className={cn("transition-colors relative z-10", isActive ? "text-accent" : "group-hover:text-accent")} />
              <span className="text-sm relative z-10">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {user ? (
        <div className="pt-8 border-t border-white/5">
          <button
            type="button"
            onClick={() => router.push('/me')}
            className="w-full flex items-center gap-3 px-2 mb-6 group cursor-pointer text-left"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-lg group-hover:shadow-neon transition-all duration-300">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                user.email?.[0].toUpperCase()
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm text-white font-medium truncate group-hover:text-accent transition-colors">{profile?.nickname || user.email}</p>
              <p className="text-xs text-secondary/60 truncate">个人中心</p>
            </div>
          </button>
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 w-full text-secondary hover:text-white hover:bg-white/5 rounded-xl transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            {t('sidebar.signOut')}
          </button>
        </div>
      ) : (
        <div className="pt-8 border-t border-white/5">
           <Link 
            data-tour="signin"
            href={`/auth?returnTo=${encodeURIComponent('/')}`}
            className="flex items-center justify-center gap-2 px-4 py-3 w-full bg-white text-black hover:bg-gray-200 rounded-full transition-all text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            {t('sidebar.signIn')}
          </Link>
        </div>
      )}
      
      <div className="mt-auto pt-8 text-center">
        <p className="text-[10px] text-white/10 font-sans tracking-widest uppercase hover:text-white/30 transition-colors cursor-default">
          Made by Cuins
        </p>
      </div>
    </aside>
  )
}

export default Sidebar
