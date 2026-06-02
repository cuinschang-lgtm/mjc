'use client'

import { ImagePlus, Loader2, Save, Check } from 'lucide-react'
import { cn, makeAvatarUrl } from '@/components/me/meUtils'

export default function ProfilePanel({
  loading,
  saving,
  nickname,
  setNickname,
  nicknameAvailable,
  signature,
  setSignature,
  bio,
  setBio,
  avatarUrl,
  setAvatarUrl,
  onPickFile,
  onSave,
}) {
  const defaultAvatars = [
    makeAvatarUrl('minimal abstract avatar, circular gradient, neon red and deep black, soft glow, centered, clean, modern UI, vector-like, no text'),
    makeAvatarUrl('minimal abstract avatar, geometric shapes, warm orange and dark charcoal, soft blur glow, centered, clean, modern UI, no text'),
    makeAvatarUrl('minimal abstract avatar, monochrome ink splash, high contrast, centered, clean, modern UI, no text'),
    makeAvatarUrl('minimal abstract avatar, synthwave grid sphere, neon magenta and cyan accents, dark background, centered, no text'),
    makeAvatarUrl('minimal abstract avatar, soft pastel blobs, subtle grain, centered, clean UI, no text'),
    makeAvatarUrl('minimal abstract avatar, paper cut layers, deep red accents, dark background, centered, clean UI, no text'),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-lg">资料</div>
          <div className="text-xs text-white/45 mt-1">昵称需唯一，支持简介与签名，头像支持上传裁剪。</div>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || loading}
          className={
            saving || loading
              ? 'h-10 px-4 rounded-xl bg-white/10 text-white/40 font-bold cursor-not-allowed inline-flex items-center gap-2'
              : 'h-10 px-4 rounded-xl bg-accent text-black font-bold inline-flex items-center gap-2'
          }
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          保存
        </button>
      </div>

      {loading ? (
        <div className="text-white/60 text-sm inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          加载中…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-white/80">昵称（2–20）</div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-accent/40"
                  maxLength={20}
                  placeholder="给自己起个名字"
                />
                {nickname.trim().length >= 2 ? (
                  nicknameAvailable === true ? (
                    <span className="text-xs text-green-300 inline-flex items-center gap-1">
                      <Check size={14} />
                      可用
                    </span>
                  ) : nicknameAvailable === false ? (
                    <span className="text-xs text-red-300">已被占用</span>
                  ) : (
                    <span className="text-xs text-white/40">校验中…</span>
                  )
                ) : (
                  <span className="text-xs text-white/40">至少 2 个字符</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-white/80">个性签名（60字内）</div>
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="w-full mt-2 h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-accent/40"
                maxLength={60}
                placeholder="例如：保持好奇心"
              />
              <div className="text-xs text-white/45 mt-1">{String(signature || '').length}/60</div>
            </div>

            <div>
              <div className="text-sm text-white/80">个人简介（200字内）</div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full mt-2 min-h-[120px] px-3 py-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-accent/40"
                maxLength={200}
                placeholder="写点关于你自己的介绍…"
              />
              <div className="text-xs text-white/45 mt-1">{String(bio || '').length}/200</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/80">头像</div>
              <label className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 inline-flex items-center gap-2 cursor-pointer">
                <ImagePlus size={16} />
                上传
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {defaultAvatars.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setAvatarUrl(u)}
                  className={cn(
                    'aspect-square rounded-2xl overflow-hidden border bg-black/20',
                    avatarUrl === u ? 'border-accent/60' : 'border-white/10 hover:border-white/20'
                  )}
                >
                  <img src={u} alt="default avatar" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <div className="text-xs text-white/45">选择默认头像或上传裁剪后再点“保存”。</div>
          </div>
        </div>
      )}
    </div>
  )
}

