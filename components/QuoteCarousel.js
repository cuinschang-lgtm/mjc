'use client'

import { useEffect, useState, useCallback } from 'react'
import { musicQuotes } from '@/lib/musicQuotes'

export default function QuoteCarousel({ language = 'zh-CN' }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * musicQuotes.length))
  const [visible, setVisible] = useState(true)

  const next = useCallback(() => {
    setVisible(false)
    setTimeout(() => {
      setIndex((i) => (i + 1) % musicQuotes.length)
      setVisible(true)
    }, 600)
  }, [])

  useEffect(() => {
    const timer = setInterval(next, 8000)
    return () => clearInterval(timer)
  }, [next])

  const q = musicQuotes[index]
  const userLangIsZh = language.startsWith('zh')
  const userLangIsEn = language.startsWith('en')
  const userLangIsJa = language.startsWith('ja')

  const needsTranslation = (() => {
    if (q.lang === 'zh' && userLangIsZh) return false
    if (q.lang === 'en' && userLangIsEn) return false
    if (q.lang === 'ja' && userLangIsJa) return false
    return true
  })()

  const translation = (() => {
    if (!needsTranslation) return null
    if (userLangIsZh) return q.translation_zh || null
    if (userLangIsEn) return q.translation_en || null
    return q.translation_zh || q.translation_en || null
  })()

  return (
    <div className="relative min-h-[140px]">
      <div
        className="transition-opacity duration-500 ease-in-out"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <span className="text-3xl text-white/20 font-serif leading-none select-none block mb-2">"</span>
        <p className="text-white/70 text-sm leading-relaxed italic">
          {q.quote}
        </p>
        {translation && (
          <p className="text-white/40 text-xs leading-relaxed mt-2">
            {translation}
          </p>
        )}
        <p className="text-white/30 text-xs mt-3">
          — {q.author}
        </p>
      </div>
    </div>
  )
}
