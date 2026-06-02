'use client'

import Link from 'next/link'
import { Loader2, Trash2 } from 'lucide-react'
import { cn, formatTime } from '@/components/me/meUtils'

export default function NotificationsPanel({ notifications, loading, onRefresh, onMarkAllRead, onMarkRead, onClearAll }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-lg">通知</div>
          <div className="text-xs text-white/45 mt-1">收到的赞与乐评被收藏会出现在这里。</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClearAll}
            className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 inline-flex items-center gap-2"
          >
            <Trash2 size={16} />
            清空
          </button>
          <button type="button" onClick={onMarkAllRead} className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80">
            全部已读
          </button>
          <button type="button" onClick={onRefresh} className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80">
            刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-white/60 text-sm inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          加载中…
        </div>
      ) : notifications.length ? (
        <div className="space-y-3">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onMarkRead?.(n.id)}
              className={cn(
                'w-full text-left rounded-2xl border bg-black/20 p-4 hover:bg-white/5 transition-colors',
                n.is_read ? 'border-white/10' : 'border-accent/30'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden border border-white/10 shrink-0">
                      {n.payload?.actorAvatarUrl ? <img src={n.payload.actorAvatarUrl} alt="avatar" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white font-semibold truncate">{n.title || '通知'}</div>
                      <div className="text-xs text-white/45 mt-1">{formatTime(n.created_at)}</div>
                    </div>
                  </div>

                  {n.content ? <div className="mt-2 text-sm text-white/80 leading-relaxed">{n.content}</div> : null}
                  {n.payload?.excerpt ? <div className="mt-2 text-xs text-white/50">{n.payload.excerpt}</div> : null}

                  {n.payload?.albumId ? (
                    <div className="mt-3">
                      <Link
                        href={`/album/${encodeURIComponent(n.payload.albumId)}`}
                        className="inline-flex items-center text-xs text-accent hover:text-accent/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        打开相关专辑
                      </Link>
                    </div>
                  ) : null}
                </div>
                {!n.is_read ? <span className="mt-1 w-2.5 h-2.5 rounded-full bg-accent" /> : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-sm text-white/50">暂无通知。</div>
      )}
    </div>
  )
}
