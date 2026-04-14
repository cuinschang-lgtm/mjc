'use client'

import { Bell, Bookmark, ChevronRight, User } from 'lucide-react'
import { cn } from '@/components/me/meUtils'

export default function MeSideNav({ tab, setTab, notiUnread, userLabel, signature, avatarUrl }) {
  return (
    <aside className="space-y-5">
      <div className="glass-panel p-6 rounded-3xl border border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 overflow-hidden border border-white/10">
            {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : null}
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold truncate">{userLabel}</div>
            <div className="text-xs text-white/45 truncate">{signature || '写一句个性签名吧'}</div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-2 rounded-3xl border border-white/10">
        <button
          type="button"
          onClick={() => setTab('profile')}
          className={cn(
            'w-full px-4 py-3 rounded-2xl flex items-center justify-between text-sm',
            tab === 'profile' ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
          )}
        >
          <span className="inline-flex items-center gap-3">
            <User size={16} />
            资料
          </span>
          <ChevronRight size={16} className={tab === 'profile' ? 'text-white' : 'text-white/30'} />
        </button>

        <button
          type="button"
          onClick={() => setTab('favorites')}
          className={cn(
            'w-full px-4 py-3 rounded-2xl flex items-center justify-between text-sm',
            tab === 'favorites' ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
          )}
        >
          <span className="inline-flex items-center gap-3">
            <Bookmark size={16} />
            我的收藏
          </span>
          <ChevronRight size={16} className={tab === 'favorites' ? 'text-white' : 'text-white/30'} />
        </button>

        <button
          type="button"
          onClick={() => setTab('notifications')}
          className={cn(
            'w-full px-4 py-3 rounded-2xl flex items-center justify-between text-sm',
            tab === 'notifications' ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
          )}
        >
          <span className="inline-flex items-center gap-3">
            <Bell size={16} />
            通知
            {notiUnread ? <span className="ml-1 px-2 py-0.5 rounded-full bg-accent text-black text-xs font-bold">{notiUnread}</span> : null}
          </span>
          <ChevronRight size={16} className={tab === 'notifications' ? 'text-white' : 'text-white/30'} />
        </button>
      </div>
    </aside>
  )
}

