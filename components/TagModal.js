'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabaseBrowser'
import { useLanguage } from '@/contexts/LanguageContext'
import TagEditor from './TagEditor'

export default function TagModal({ isOpen, onClose, collectionId, initialTags = [], onUpdate }) {
  const [tags, setTags] = useState(initialTags)
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()

  const lastInitKeyRef = useRef('')
  const openedRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return
    const arr = Array.isArray(initialTags) ? initialTags : []
    const key = JSON.stringify(arr)
    if (key !== lastInitKeyRef.current) {
      lastInitKeyRef.current = key
      setTags(arr)
    }
  }, [isOpen, collectionId, initialTags])

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false
      return
    }
    if (openedRef.current) return
    openedRef.current = true
    try {
      window.dispatchEvent(new CustomEvent('pickup:onboarding', { detail: { type: 'tags:modal_opened', collectionId } }))
    } catch {}
  }, [isOpen, collectionId])

  if (!isOpen) return null

  const handleSave = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('user_collections')
        .update({ custom_tags: tags })
        .eq('id', collectionId)

      if (error) throw error
      
      onUpdate(collectionId, tags)
      try {
        window.dispatchEvent(new CustomEvent('pickup:onboarding', { detail: { type: 'tags:saved', collectionId } }))
      } catch {}
      onClose()
    } catch (error) {
      console.error('Error updating tags:', error)
      alert(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-card border border-white/10 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        data-tour="tag-modal"
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
            <Tag size={18} className="text-accent" />
            {t('library.manageTags')}
          </h3>
          <button onClick={onClose} className="text-secondary hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6" data-tour="tag-editor">
          <TagEditor
            value={tags}
            onChange={setTags}
            maxTags={12}
            maxTagLength={20}
            placeholder={t('library.addTagPlaceholder')}
            disabled={loading}
          />
        </div>

        <div className="p-4 bg-white/5 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-secondary hover:text-white transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            data-tour="tag-save"
            className="px-6 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('library.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  )
}
