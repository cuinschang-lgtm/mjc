'use client'

import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Underline, Link2, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const html = String(value || '')
    if (el.innerHTML !== html) el.innerHTML = html
  }, [value])

  const exec = (cmd, arg = null) => {
    const el = ref.current
    if (!el) return
    el.focus()
    try {
      document.execCommand(cmd, false, arg)
    } catch {}
    onChange?.(el.innerHTML)
  }

  const insertLink = () => {
    const url = prompt('请输入链接（http/https）')
    if (!url) return
    if (!/^https?:\/\//i.test(url)) return
    exec('createLink', url)
  }

  const insertImage = () => {
    const url = prompt('请输入图片 URL（http/https）')
    if (!url) return
    if (!/^https?:\/\//i.test(url)) return
    exec('insertImage', url)
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10">
        <button
          type="button"
          onClick={() => exec('bold')}
          className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition"
          aria-label="加粗"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition"
          aria-label="斜体"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition"
          aria-label="下划线"
        >
          <Underline size={16} />
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          type="button"
          onClick={insertLink}
          className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition"
          aria-label="插入链接"
        >
          <Link2 size={16} />
        </button>
        <button
          type="button"
          onClick={insertImage}
          className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition"
          aria-label="插入图片"
        >
          <ImageIcon size={16} />
        </button>
        <div className="ml-auto text-[10px] text-white/40">HTML</div>
      </div>

      <div
        ref={ref}
        className={cn(
          'min-h-[220px] p-4 text-sm text-white/90 outline-none rounded-b-2xl',
          focused ? 'ring-1 ring-accent/40' : ''
        )}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onInput={() => onChange?.(ref.current?.innerHTML || '')}
        data-placeholder={placeholder || ''}
      />

      <style jsx>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: rgba(255, 255, 255, 0.35);
        }
        [contenteditable] a {
          color: rgb(255, 77, 77);
          text-decoration: underline;
        }
        [contenteditable] img {
          max-width: 100%;
          border-radius: 12px;
          display: block;
          margin: 12px 0;
        }
      `}</style>
    </div>
  )
}

