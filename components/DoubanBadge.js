'use client'

import { useEffect, useState } from 'react'

export default function DoubanBadge({ title, artist, className = '' }) {
  const [score, setScore] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    const fetchScore = async () => {
      try {
        setLoading(true)
        const url = `/api/douban-rating?title=${encodeURIComponent(title || '')}&artist=${encodeURIComponent(artist || '')}`
        const res = await fetch(url)
        const data = await res.json()
        if (!ignore) setScore(typeof data.score === 'number' ? data.score : null)
      } catch (_) {
        if (!ignore) setScore(null)
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    if (title) fetchScore()
    return () => { ignore = true }
  }, [title, artist])

  if (loading && score == null) {
    return (
      <div className={`absolute top-3 left-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/60 ${className}`}>DB…</div>
    )
  }
  if (score == null) return null
  return (
    <div className={`absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-lg ${className}`} title="Douban">
      <span className="text-[10px] font-bold text-green-400">豆瓣</span>
      <span className="text-xs font-black text-yellow-400">{score}</span>
    </div>
  )
}

