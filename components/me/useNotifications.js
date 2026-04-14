'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'

export function useNotifications({ userId, enabled, showToast }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id,user_id,type,title,content,payload,is_read,created_at,read_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw new Error(error.message)
      setItems(data || [])
      setUnread((data || []).filter((x) => !x.is_read).length)
    } catch (e) {
      setItems([])
      showToast?.(e?.message || '通知加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [enabled, showToast])

  const markAllRead = useCallback(async () => {
    if (!enabled || !userId) return
    const now = new Date().toISOString()
    const { error } = await supabase.from('notifications').update({ is_read: true, read_at: now }).eq('user_id', userId).eq('is_read', false)
    if (error) throw new Error(error.message)
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at || now })))
    setUnread(0)
  }, [enabled, userId])

  const markRead = useCallback(
    async (id) => {
      if (!enabled || !userId || !id) return
      const now = new Date().toISOString()
      const { error } = await supabase.from('notifications').update({ is_read: true, read_at: now }).eq('id', id).eq('user_id', userId)
      if (error) throw new Error(error.message)
      setItems((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n
          return { ...n, is_read: true, read_at: n.read_at || now }
        })
      )
      setUnread((n) => {
        const target = items.find((x) => x.id === id)
        if (!target || target.is_read) return n
        return Math.max(0, n - 1)
      })
    },
    [enabled, userId, items]
  )

  const clearAll = useCallback(async () => {
    if (!enabled || !userId) return
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId)
    if (error) throw new Error(error.message)
    setItems([])
    setUnread(0)
  }, [enabled, userId])

  useEffect(() => {
    if (!enabled || !userId) return
    const channel = supabase
      .channel(`noti-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload?.new
        if (!row?.id) return
        setItems((prev) => [row, ...prev])
        setUnread((n) => n + 1)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, userId])

  useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => {
      refresh()
    }, 20000)
    return () => clearInterval(t)
  }, [enabled, refresh])

  return { items, loading, unread, refresh, markAllRead, markRead, clearAll }
}
