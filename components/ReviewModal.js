'use client'

import { useEffect, useState } from 'react'
import { X, ExternalLink, Quote, AlertCircle, Star } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function ReviewModal({ isOpen, onClose, album }) {
  const { t } = useLanguage()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      setTimeout(() => setIsVisible(false), 200)
    }
  }, [isOpen])

  if (!isVisible && !isOpen) return null

  // Mock data fallback if DB doesn't have it
  const review = album?.albums?.reviews_aggregator?.[0] || {
    source_name: 'Metacritic',
    score: album?.albums?.reviews_aggregator?.[0]?.score || 'N/A',
    expert_review_summary: 'No review summary available.',
    url: `https://www.google.com/search?q=${encodeURIComponent(album?.albums?.artist + ' ' + album?.albums?.title + ' review')}`
  }

  // Determine score color
  const getScoreColor = (score) => {
    const num = parseFloat(score)
    if (!num) return 'text-secondary'
    if (num >= 8.0) return 'text-green-400'
    if (num >= 6.0) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div 
      className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-all duration-200 ${isOpen ? 'bg-black/80 backdrop-blur-sm opacity-100' : 'bg-black/0 backdrop-blur-none opacity-0 pointer-events-none'}`}
      onClick={onClose}
    >
      <div 
        className={`bg-[#121212] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl transition-all duration-300 transform ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative h-32 bg-gradient-to-b from-accent/20 to-[#121212]">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors backdrop-blur-md"
          >
            <X size={20} />
          </button>
          
          <div className="absolute -bottom-10 left-6 flex items-end gap-4">
             <div className="w-24 h-24 rounded-lg shadow-xl border-2 border-[#121212] overflow-hidden bg-[#121212]">
                <img 
                  src={album?.albums?.cover_url || '/placeholder.png'} 
                  alt={album?.albums?.title}
                  className="w-full h-full object-cover"
                />
             </div>
             <div className="mb-2">
                <h3 className="text-xl font-bold text-white leading-tight line-clamp-1">{album?.albums?.title}</h3>
                <p className="text-secondary text-sm">{album?.albums?.artist}</p>
             </div>
          </div>
        </div>

        <div className="pt-12 px-6 pb-6 space-y-6">
          {/* Score Section */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
             <div className="flex items-center gap-3">
                <div className="bg-black/40 p-2 rounded-lg">
                  <Star className={getScoreColor(review.score)} size={24} fill="currentColor" />
                </div>
                <div>
                   <p className="text-xs text-secondary uppercase tracking-wider font-medium">Critic Score</p>
                   <p className={`text-2xl font-bold ${getScoreColor(review.score)}`}>{review.score}</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-xs text-secondary uppercase tracking-wider font-medium">Source</p>
                <p className="text-white font-medium">{review.source_name}</p>
             </div>
          </div>

          {/* Review Content */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-accent text-sm font-medium">
               <Quote size={16} />
               <span>Expert Review</span>
             </div>
             <p className="text-white/80 leading-relaxed text-sm italic border-l-2 border-accent/30 pl-4 py-1">
               {review.expert_review_summary
                 ? `“${review.expert_review_summary}”`
                 : '“A defining album of the genre, blending intricate melodies with raw emotion.”'}
             </p>
          </div>

          {/* Legal/Copyright Notice */}
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3 flex gap-3 items-start">
             <AlertCircle size={16} className="text-blue-400 mt-0.5 shrink-0" />
             <div className="space-y-1">
               <p className="text-[10px] text-blue-200/80 leading-tight">
                 <strong>Copyright Notice:</strong> The review excerpt above is cited for informational and educational purposes under Fair Use principles. All rights belong to the original author and publication.
               </p>
               <a 
                 href={review.url} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="text-[10px] text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
               >
                 Read full review on {review.source_name} <ExternalLink size={8} />
               </a>
             </div>
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end">
           <a 
             href={review.url}
             target="_blank"
             rel="noopener noreferrer"
             className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-gray-200 transition-colors"
           >
             Read Full Review <ExternalLink size={14} />
           </a>
        </div>
      </div>
    </div>
  )
}
