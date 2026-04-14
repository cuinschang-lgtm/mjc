'use client'

import { useCallback, useState } from 'react'

export function useFavorites({ token, showToast }) {
  const [favorites, setFavorites] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(
    async (more = false) => {
      if (!token) return
      if (more) setLoadingMore(true)
      else setLoading(true)
      try {
        const url = `/api/me/favorites${more && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error || '加载失败')
        const next = Array.isArray(json?.favorites) ? json.favorites : []
        setFavorites((prev) => (more ? [...prev, ...next] : next))
        setCursor(json?.nextCursor || null)
      } catch (e) {
        if (!more) setFavorites([])
        showToast?.(e?.message || '加载失败', 'error')
      } finally {
        if (more) setLoadingMore(false)
        else setLoading(false)
      }
    },
    [token, cursor, showToast]
  )

  const unfavorite = useCallback(
    async (reviewId) => {
      if (!token) return
      const res = await fetch(`/api/review/${encodeURIComponent(reviewId)}/favorite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || '取消收藏失败')
      setFavorites((prev) => prev.filter((x) => x?.review?.id !== reviewId))
    },
    [token]
  )

  return { favorites, cursor, loading, loadingMore, load, unfavorite }
}

