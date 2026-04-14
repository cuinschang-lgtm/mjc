'use client'

import { cn } from '@/components/me/meUtils'

export default function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={cn(
          'px-4 py-3 rounded-2xl border text-sm shadow-xl',
          toast.type === 'error'
            ? 'bg-red-500/15 border-red-500/25 text-red-200'
            : 'bg-white/10 border-white/15 text-white'
        )}
      >
        {toast.text}
      </div>
    </div>
  )
}

