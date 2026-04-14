'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

async function fileToDataUrl(file) {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:${file.type};base64,${btoa(binary)}`
}

function drawCropped(img, size, scale, offset) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas not supported')

  const base = Math.max(size / img.width, size / img.height)
  const s = base * scale

  const dw = img.width * s
  const dh = img.height * s
  const dx = (size - dw) / 2 + offset.x
  const dy = (size - dh) / 2 + offset.y

  ctx.clearRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, dx, dy, dw, dh)
  return canvas
}

async function canvasToBlob(canvas, type) {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, 0.92)
  })
}

export default function AvatarCropModal({ file, open, onClose, onConfirm }) {
  const [img, setImg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ x: 0, y: 0 })
  const viewportRef = useRef(null)

  const type = useMemo(() => {
    const t = String(file?.type || '')
    if (t === 'image/png') return 'image/png'
    return 'image/jpeg'
  }, [file])

  useEffect(() => {
    if (!open || !file) return
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        const url = await fileToDataUrl(file)
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.src = url
        await new Promise((resolve, reject) => {
          image.onload = () => resolve()
          image.onerror = () => reject(new Error('load failed'))
        })
        if (cancelled) return
        setImg(image)
        setScale(1)
        setOffset({ x: 0, y: 0 })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [open, file])

  const onPointerDown = (e) => {
    if (!viewportRef.current) return
    setDragging(true)
    dragRef.current = { x: e.clientX, y: e.clientY }
    viewportRef.current.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!dragging) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    dragRef.current = { x: e.clientX, y: e.clientY }
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const onPointerUp = () => {
    setDragging(false)
  }

  const confirm = async () => {
    if (!img) return
    try {
      setLoading(true)
      const s = clamp(scale, 1, 3)
      const c200 = drawCropped(img, 200, s, offset)
      const c100 = drawCropped(img, 100, s, { x: offset.x / 2, y: offset.y / 2 })
      const b200 = await canvasToBlob(c200, type)
      const b100 = await canvasToBlob(c100, type)
      await onConfirm?.({ blob200: b200, blob100: b100, type })
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0d10]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="text-white font-bold">裁剪头像</div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 inline-flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-center justify-center">
            <div
              ref={viewportRef}
              className="relative w-64 h-64 rounded-2xl overflow-hidden border border-white/10 bg-black/30 touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {img ? (
                <img
                  src={img.src}
                  alt="crop"
                  className="absolute left-1/2 top-1/2 select-none"
                  style={{
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: 'center',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">
                  {loading ? '加载中…' : '图片加载失败'}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>缩放</span>
              <span className="tabular-nums">{scale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value) || 1)}
              className="w-full mt-2"
            />
            <div className="mt-2 text-xs text-white/40">拖拽图片调整位置，生成 200×200 与 100×100 两个尺寸。</div>
          </div>
        </div>

        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80"
          >
            取消
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!img || loading}
            className={!img || loading ? 'h-11 px-5 rounded-xl bg-white/10 text-white/40 font-bold cursor-not-allowed' : 'h-11 px-5 rounded-xl bg-accent text-black font-bold'}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

