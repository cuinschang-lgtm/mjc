'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '../lib/utils'

export function sanitizeTag(raw, { maxLength = 20 } = {}) {
  const value = String(raw ?? '')
    .replace(/^#+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!value) return ''

  const filtered = value.replace(/[^\p{L}\p{N}\s\-_]/gu, '')
  const collapsed = filtered.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''

  return collapsed.length > maxLength ? collapsed.slice(0, maxLength) : collapsed
}

function normalizeTag(tag) {
  return tag.toLocaleLowerCase()
}

export default function TagEditor({
  value,
  onChange,
  maxTags = 12,
  maxTagLength = 20,
  placeholder = 'Add a tag…',
  disabled = false,
  className,
  inputClassName,
}) {
  const tags = Array.isArray(value) ? value : []
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(() => new Set())
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef(null)

  const normalizedSet = useMemo(() => {
    const s = new Set()
    for (const t of tags) s.add(normalizeTag(String(t)))
    return s
  }, [tags])

  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(''), 1800)
    return () => clearTimeout(id)
  }, [error])

  const canAddMore = tags.length < maxTags
  const cleanedInput = useMemo(() => sanitizeTag(input, { maxLength: maxTagLength }), [input, maxTagLength])
  const isDuplicate = cleanedInput ? normalizedSet.has(normalizeTag(cleanedInput)) : false

  const commitAdd = () => {
    if (disabled) return

    const next = sanitizeTag(input, { maxLength: maxTagLength })
    if (!next) {
      setError('标签不能为空')
      return
    }
    if (!canAddMore) {
      setError(`最多 ${maxTags} 个标签`)
      return
    }
    if (normalizedSet.has(normalizeTag(next))) {
      setError('标签重复')
      return
    }

    onChange?.([...tags, next])
    setInput('')
    inputRef.current?.focus()
  }

  const commitRemove = (tag) => {
    if (disabled) return
    const key = normalizeTag(tag)
    setRemoving((prev) => new Set(prev).add(key))
    window.setTimeout(() => {
      onChange?.(tags.filter((t) => normalizeTag(String(t)) !== key))
      setRemoving((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, 160)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (isComposing) return
      e.preventDefault()
      commitAdd()
      return
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      commitRemove(tags[tags.length - 1])
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'input-modern w-full pr-10',
              error ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/40' : '',
              inputClassName
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-secondary/60 select-none">
            {tags.length}/{maxTags}
          </div>
        </div>

        <button
          type="button"
          onClick={commitAdd}
          disabled={disabled || !cleanedInput || !canAddMore || isDuplicate}
          className={cn(
            'h-[46px] w-[46px] rounded-xl border border-white/10 bg-white/5 text-white transition-all duration-200 flex items-center justify-center',
            'hover:bg-white/10 hover:border-white/20 active:scale-[0.98]',
            'disabled:opacity-40 disabled:pointer-events-none'
          )}
          aria-label="Add tag"
        >
          <Plus size={18} />
        </button>
      </div>

      {(error || (cleanedInput && isDuplicate)) && (
        <div className="text-xs font-medium text-red-400">
          {error || '标签重复'}
        </div>
      )}

      <div className="flex flex-wrap gap-2 min-h-[44px]">
        {tags.length === 0 ? (
          <div className="text-secondary/70 text-sm italic py-2">暂无标签</div>
        ) : (
          tags.map((tag) => {
            const key = normalizeTag(String(tag))
            const isRemoving = removing.has(key)
            return (
              <span
                key={key}
                className={cn(
                  'inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-white/10 bg-white/5 text-white text-sm font-medium',
                  'transition-all duration-200',
                  isRemoving ? 'opacity-0 scale-95' : 'opacity-100 scale-100 tag-pop'
                )}
              >
                <span className="text-white/50">#</span>
                <span className="max-w-[240px] truncate">{tag}</span>
                <button
                  type="button"
                  onClick={() => commitRemove(tag)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X size={14} />
                </button>
              </span>
            )
          })
        )}
      </div>
    </div>
  )
}

