'use client'

import { useMemo, useState } from 'react'
import { Star } from 'lucide-react'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function StarCell({ index, value, hoverValue, disabled, onPick }) {
  const filled = (hoverValue ?? value) >= index
  const half = !filled && (hoverValue ?? value) >= index - 0.5

  const fillStyle = useMemo(() => {
    if (filled) return { clipPath: 'inset(0 0 0 0)' }
    if (half) return { clipPath: 'inset(0 50% 0 0)' }
    return null
  }, [filled, half])

  return (
    <div className={disabled ? 'relative w-5 h-5 opacity-60' : 'relative w-5 h-5'}>
      <Star size={20} className="absolute inset-0 text-white/20" />
      {fillStyle ? (
        <Star size={20} className="absolute inset-0 text-yellow-400" fill="currentColor" style={fillStyle} />
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onMouseEnter={() => onPick(index - 0.5, false)}
        onClick={() => onPick(index - 0.5, true)}
        className="absolute left-0 top-0 h-full w-1/2"
        aria-label={`${index - 0.5} 分`}
      />
      <button
        type="button"
        disabled={disabled}
        onMouseEnter={() => onPick(index, false)}
        onClick={() => onPick(index, true)}
        className="absolute right-0 top-0 h-full w-1/2"
        aria-label={`${index} 分`}
      />
    </div>
  )
}

export default function StarRating10({ value, disabled, onChange, className }) {
  const [hoverValue, setHoverValue] = useState(null)
  const v = clamp(Number(value) || 0, 0, 10)

  const onPick = (next, commit) => {
    const n = clamp(Math.round(Number(next) * 2) / 2, 0.5, 10)
    if (commit) onChange?.(n)
    else setHoverValue(n)
  }

  return (
    <div
      className={className || 'flex items-center gap-1'}
      onMouseLeave={() => setHoverValue(null)}
      role="radiogroup"
      aria-disabled={disabled ? 'true' : 'false'}
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <StarCell
          key={i}
          index={i + 1}
          value={v}
          hoverValue={hoverValue}
          disabled={disabled}
          onPick={onPick}
        />
      ))}
      <div className="ml-2 text-xs text-white/60 tabular-nums">{v ? `${v.toFixed(1)}/10` : '未评分'}</div>
    </div>
  )
}

