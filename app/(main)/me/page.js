'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AvatarCropModal from '@/components/AvatarCropModal'
import FavoritesPanel from '@/components/me/FavoritesPanel'
import MeSideNav from '@/components/me/MeSideNav'
import NotificationsPanel from '@/components/me/NotificationsPanel'
import ProfilePanel from '@/components/me/ProfilePanel'
import Toast from '@/components/me/Toast'
import { useFavorites } from '@/components/me/useFavorites'
import { useNotifications } from '@/components/me/useNotifications'
import { supabase } from '@/lib/supabaseBrowser'

export default function MePage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('profile')

  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nickname, setNickname] = useState('')
  const [nicknameAvailable, setNicknameAvailable] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')
  const [signature, setSignature] = useState('')

  const [pickFile, setPickFile] = useState(null)
  const [cropOpen, setCropOpen] = useState(false)

  const token = session?.access_token || null
  const user = session?.user || null

  const showToast = (text, type = 'ok') => {
    setToast({ text, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  const favoritesState = useFavorites({ token, showToast })
  const notificationsState = useNotifications({ userId: user?.id || null, enabled: !!user, showToast })

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data?.session || null)
      if (!data?.session) router.push('/auth')
    }
    init()
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) router.push('/auth')
    })
    return () => data?.subscription?.unsubscribe()
  }, [router])

  useEffect(() => {
    const run = async () => {
      if (!token) return
      setProfileLoading(true)
      try {
        const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error || '加载失败')
        const p = json?.profile || {}
        setNickname(p.nickname || '')
        setAvatarUrl(p.avatarUrl || '')
        setBio(p.bio || '')
        setSignature(p.signature || '')
      } catch (e) {
        showToast(e?.message || '加载失败', 'error')
      } finally {
        setProfileLoading(false)
      }
    }
    run()
  }, [token])

  useEffect(() => {
    if (!token) return
    const v = String(nickname || '').trim()
    if (v.length < 2) {
      setNicknameAvailable(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/nickname/check?nickname=${encodeURIComponent(v)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error || '校验失败')
        setNicknameAvailable(Boolean(json?.available))
      } catch {
        setNicknameAvailable(null)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [nickname, token])

  const saveProfile = async () => {
    if (!token || saving) return
    try {
      setSaving(true)
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nickname: nickname.trim() || null, avatarUrl: avatarUrl || null, bio: bio || null, signature: signature || null }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || '保存失败')
      showToast('已保存')
    } catch (e) {
      showToast(e?.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const pickAvatarFile = (f) => {
    if (!f) return
    if (!(f.type === 'image/jpeg' || f.type === 'image/png')) {
      showToast('仅支持 JPG/PNG', 'error')
      return
    }
    if (f.size > 2 * 1024 * 1024) {
      showToast('图片需 ≤ 2MB', 'error')
      return
    }
    setPickFile(f)
    setCropOpen(true)
  }

  const uploadAvatar = async ({ blob200, blob100, type }) => {
    if (!user) return
    const ext = type === 'image/png' ? 'png' : 'jpg'
    const p200 = `${user.id}/avatar_200.${ext}`
    const p100 = `${user.id}/avatar_100.${ext}`

    const up200 = await supabase.storage.from('avatars').upload(p200, blob200, { upsert: true, contentType: type })
    if (up200.error) throw new Error(up200.error.message)
    const up100 = await supabase.storage.from('avatars').upload(p100, blob100, { upsert: true, contentType: type })
    if (up100.error) throw new Error(up100.error.message)

    const url = supabase.storage.from('avatars').getPublicUrl(p200)
    const publicUrl = url?.data?.publicUrl || ''
    if (!publicUrl) throw new Error('avatar url missing')
    setAvatarUrl(publicUrl)
    showToast('头像已更新，记得保存')
  }

  useEffect(() => {
    if (tab === 'favorites') favoritesState.load(false)
    if (tab === 'notifications') notificationsState.refresh()
  }, [tab, favoritesState, notificationsState])

  if (!session) return null

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      <Toast toast={toast} />
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">个人中心</h1>
        <p className="text-secondary">管理你的资料、收藏与通知。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
        <MeSideNav
          tab={tab}
          setTab={setTab}
          notiUnread={notificationsState.unread}
          userLabel={nickname || user?.email || '我'}
          signature={signature}
          avatarUrl={avatarUrl}
        />

        <section className="glass-panel p-6 rounded-3xl border border-white/10 min-h-[520px]">
          {tab === 'profile' ? (
            <ProfilePanel
              loading={profileLoading}
              saving={saving}
              nickname={nickname}
              setNickname={setNickname}
              nicknameAvailable={nicknameAvailable}
              signature={signature}
              setSignature={setSignature}
              bio={bio}
              setBio={setBio}
              avatarUrl={avatarUrl}
              setAvatarUrl={setAvatarUrl}
              onPickFile={pickAvatarFile}
              onSave={saveProfile}
            />
          ) : null}

          {tab === 'favorites' ? (
            <FavoritesPanel
              favorites={favoritesState.favorites}
              cursor={favoritesState.cursor}
              loading={favoritesState.loading}
              loadingMore={favoritesState.loadingMore}
              onRefresh={() => favoritesState.load(false)}
              onLoadMore={() => favoritesState.load(true)}
              onUnfavorite={(id) => favoritesState.unfavorite(id).catch((e) => showToast(e?.message || '取消收藏失败', 'error'))}
            />
          ) : null}

          {tab === 'notifications' ? (
            <NotificationsPanel
              notifications={notificationsState.items}
              loading={notificationsState.loading}
              onRefresh={notificationsState.refresh}
              onMarkAllRead={() =>
                notificationsState
                  .markAllRead()
                  .then(() => showToast('已全部标记已读'))
                  .catch((e) => showToast(e?.message || '操作失败', 'error'))
              }
              onMarkRead={(id) => notificationsState.markRead(id).catch((e) => showToast(e?.message || '操作失败', 'error'))}
              onClearAll={() =>
                notificationsState
                  .clearAll()
                  .then(() => showToast('已清空'))
                  .catch((e) => showToast(e?.message || '操作失败', 'error'))
              }
            />
          ) : null}
        </section>
      </div>

      <AvatarCropModal
        file={pickFile}
        open={cropOpen}
        onClose={() => {
          setCropOpen(false)
          setPickFile(null)
        }}
        onConfirm={async (payload) => {
          try {
            await uploadAvatar(payload)
            setCropOpen(false)
            setPickFile(null)
          } catch (e) {
            showToast(e?.message || '头像上传失败', 'error')
          }
        }}
      />
    </div>
  )
}
