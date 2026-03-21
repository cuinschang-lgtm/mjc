'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'
import { BarChart3, PieChart, TrendingUp, Music, Disc } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function ChartsPage() {
  const [stats, setStats] = useState({
    total: 0,
    listened: 0,
    wantToListen: 0,
    topTags: [],
    averageScore: 0
  })
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_collections')
        .select(`
          *,
          albums (
            reviews_aggregator (
              score
            )
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      const total = data.length
      const listened = data.filter(i => i.status === 'listened').length
      const wantToListen = data.filter(i => i.status === 'want_to_listen').length

      // Calculate Tags
      const tagCounts = {}
      data.forEach(item => {
        item.custom_tags?.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        })
      })
      
      const topTags = Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count, percentage: (count / total) * 100 }))

      // Calculate Average Score
      let totalScore = 0
      let scoredCount = 0
      data.forEach(item => {
        const score = item.albums?.reviews_aggregator?.[0]?.score
        if (score) {
          totalScore += parseFloat(score)
          scoredCount++
        }
      })
      const averageScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : 0

      setStats({ total, listened, wantToListen, topTags, averageScore })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-4xl font-bold text-white mb-8 tracking-tight">{t('sidebar.charts')}</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
           {[1,2,3].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-panel p-8 rounded-3xl flex items-center gap-5 border border-white/5 hover:border-white/10 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                <Disc size={28} />
              </div>
              <div>
                <p className="text-secondary text-xs uppercase tracking-wider font-bold mb-1">{t('library.subtitle').split(' ')[1] || 'Albums'}</p>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-3xl flex items-center gap-5 border border-white/5 hover:border-white/10 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
                <Music size={28} />
              </div>
              <div>
                <p className="text-secondary text-xs uppercase tracking-wider font-bold mb-1">{t('library.filterListened')}</p>
                <p className="text-3xl font-bold text-white">{stats.listened}</p>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-3xl flex items-center gap-5 border border-white/5 hover:border-white/10 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                <TrendingUp size={28} />
              </div>
              <div>
                <p className="text-secondary text-xs uppercase tracking-wider font-bold mb-1">{t('library.filterWantToListen')}</p>
                <p className="text-3xl font-bold text-white">{stats.wantToListen}</p>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-3xl flex items-center gap-5 border border-white/5 hover:border-white/10 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                <BarChart3 size={28} />
              </div>
              <div>
                <p className="text-secondary text-xs uppercase tracking-wider font-bold mb-1">Avg. Score</p>
                <p className="text-3xl font-bold text-white">{stats.averageScore}</p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Tags */}
            <div className="glass-panel p-8 rounded-3xl border border-white/5">
              <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                <PieChart size={24} className="text-accent" />
                {t('library.tags')}
              </h3>
              
              {stats.topTags.length > 0 ? (
                <div className="space-y-6">
                  {stats.topTags.map((tag, index) => (
                    <div key={tag.name}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-white font-bold tracking-wide">#{tag.name}</span>
                        <span className="text-secondary font-medium">{tag.count}</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-accent to-orange-500 h-3 rounded-full shadow-[0_0_10px_rgba(255,77,77,0.3)] transition-all duration-1000 ease-out"
                          style={{ width: `${tag.percentage}%`, transitionDelay: `${index * 100}ms` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-secondary italic">
                  {t('library.noTags')}
                </div>
              )}
            </div>

            {/* Listening Progress */}
            <div className="glass-panel p-8 rounded-3xl border border-white/5 flex flex-col justify-center items-center text-center relative overflow-hidden">
               {/* Background Glow */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/5 rounded-full blur-[50px]" />
               
               <h3 className="text-xl font-bold text-white mb-8 w-full text-left flex items-center gap-3 relative z-10">
                  <TrendingUp size={24} className="text-green-500" />
                  Progress
               </h3>
               
               {stats.total > 0 ? (
                 <div className="relative w-64 h-64 z-10">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl">
                      <circle
                        cx="128"
                        cy="128"
                        r="110"
                        stroke="currentColor"
                        strokeWidth="16"
                        fill="transparent"
                        className="text-white/5"
                      />
                      <circle
                        cx="128"
                        cy="128"
                        r="110"
                        stroke="currentColor"
                        strokeWidth="16"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 110}
                        strokeDashoffset={2 * Math.PI * 110 * (1 - stats.listened / stats.total)}
                        className="text-green-500 transition-all duration-1000 ease-out"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black text-white tracking-tighter">
                        {Math.round((stats.listened / stats.total) * 100)}%
                      </span>
                      <span className="text-xs text-secondary uppercase tracking-[0.2em] mt-2 font-bold">Completed</span>
                    </div>
                 </div>
               ) : (
                 <div className="text-secondary italic z-10">{t('library.emptyDesc')}</div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
