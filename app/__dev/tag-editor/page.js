'use client'

import { useState } from 'react'
import TagEditor from '../../../components/TagEditor'

export default function TagEditorDevPage() {
  const [tags, setTags] = useState(['电子', '摇滚', 'city pop'])

  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-primary p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white">TagEditor Dev</h1>
        <div className="glass-panel p-6 rounded-3xl">
          <TagEditor value={tags} onChange={setTags} maxTags={6} maxTagLength={16} />
        </div>
        <div className="glass-panel p-6 rounded-3xl">
          <div className="text-xs text-secondary/70 mb-2">Current value</div>
          <pre className="text-xs text-white/80 whitespace-pre-wrap break-words">{JSON.stringify(tags, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}

