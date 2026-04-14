'use client'

import Link from 'next/link'
import { ChevronRight, Loader2 } from 'lucide-react'
import { cn, formatTime } from '@/components/me/meUtils'

export default function FavoritesPanel({
  favorites,
  cursor,
  loading,
  loadingMore,
  onRefresh,
  onLoadMore,
  onUnfavorite,
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-lg">我的收藏</div>
          <div className="text-xs text-white/45 mt-1">收藏他人的乐评，随时回看。</div>
        </div>
        <button type="button" onClick={onRefresh} className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80">
          刷新
        </button>
      </div>

      {loading ? (
        <div className="text-white/60 text-sm inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          加载中…
        </div>
      ) : favorites.length ? (
        <div className="space-y-3">
          {favorites.map((x) => (
            <div key={`${x.review.id}-${x.favoritedAt}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                      {x.review.author.avatarUrl ? <img src={x.review.author.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white font-semibold truncate">{x.review.author.nickname || '用户'}</div>
                      <div className="text-xs text-white/45">收藏于 {formatTime(x.favoritedAt)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-white font-bold truncate">{x.review.title || '（无标题）'}</div>
                  <div className="mt-1 text-xs text-yellow-300">评分：{Number(x.review.score)}/10</div>
                  <div
                    className="mt-3 text-sm text-white/80 leading-relaxed prose prose-invert max-w-none line-clamp-4"
                    dangerouslySetInnerHTML={{ __html: String(x.review.content || '') }}
                  />
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Link
                    href={`/album/${encodeURIComponent(x.review.albumId)}`}
                    className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 inline-flex items-center gap-1"
                  >
                    打开专辑
                    <ChevronRight size={14} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => onUnfavorite(x.review.id)}
                    className="h-9 px-3 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/20 text-xs text-yellow-200"
                  >
                    取消收藏
                  </button>
                </div>
              </div>
            </div>
          ))}

          {cursor ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={onLoadMore}
              className={cn(
                'h-10 px-4 rounded-xl border text-xs',
                loadingMore ? 'bg-white/10 text-white/40 cursor-not-allowed border-white/10' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
              )}
            >
              {loadingMore ? '加载中…' : '加载更多（20条/页）'}
            </button>
          ) : (
            <div className="text-xs text-white/40">没有更多了</div>
          )}
        </div>
      ) : (
        <div className="text-sm text-white/50">你还没有收藏任何乐评。</div>
      )}
    </div>
  )
}

