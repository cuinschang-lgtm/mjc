'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { Globe } from 'lucide-react'

export default function SettingsPage() {
  const { language, changeLanguage, t } = useLanguage()

  const languages = [
    { code: 'zh-CN', name: '简体中文' },
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'en-US', name: 'English' },
    { code: 'ja-JP', name: '日本語' }
  ]

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">{t('settings.title')}</h1>
        <p className="text-secondary">Customize your Pickup experience.</p>
      </div>
      
      <div className="space-y-8">
        {/* Language Settings */}
        <div className="glass-panel p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Globe size={24} className="text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">{t('settings.language')}</h2>
                <p className="text-secondary text-sm">{t('settings.languageDesc')}</p>
              </div>
            </div>
            
            <div className="relative">
              <select
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="appearance-none bg-black/20 border border-white/10 rounded-xl pl-5 pr-12 py-3 text-white text-sm font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer min-w-[180px]"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-[#18181b]">
                    {lang.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-secondary">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="glass-panel p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-black to-zinc-700 border border-white/20" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">{t('settings.theme')}</h2>
                <p className="text-secondary text-sm">{t('settings.themeDesc')}</p>
              </div>
            </div>
            
            <div className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              OffBeat Dark
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="glass-panel p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
             <div className="flex items-start gap-4">
               <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <div className="w-6 h-6 rounded-full bg-blue-500" />
               </div>
               <div>
                 <h2 className="text-xl font-bold text-white mb-1">{t('settings.account')}</h2>
                 <p className="text-secondary text-sm">{t('settings.accountDesc')}</p>
               </div>
             </div>
             
             <div className="text-right">
               <p className="text-white font-medium">user@example.com</p>
               <p className="text-xs text-secondary mt-1 uppercase tracking-wider">Free Plan</p>
             </div>
           </div>
        </div>
      </div>
    </div>
  )
}
