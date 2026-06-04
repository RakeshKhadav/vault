import React from 'react'
import { formatBytes } from '@/lib/utils/format'
import {
  Check,
  Film,
  Image as ImageIcon,
  Play,
  Star,
  Download,
  Link
} from 'lucide-react'

export interface MediaFile {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: string
  uploadedAt: string
  thumbnailUrl?: string | null
  thumbnailFileId?: string | null
  isFavorite?: boolean
  viewUrl?: string | null
  streamUrl?: string | null
}

export interface MediaGridProps {
  files: MediaFile[]
  isLoading: boolean
  isLoadingMore: boolean
  isSelectMode: boolean
  selectedIds: Set<string>
  toggleFileSelection: (id: string, event?: React.MouseEvent) => void
  setActiveMediaIndex: (index: number) => void
  toggleFavorite?: (id: string, index: number, event?: React.MouseEvent) => void
  handleShare?: (id: string, event?: React.MouseEvent) => void
  resolveThumbnailUrl?: (file: MediaFile) => string
  onPrefetchUrl?: (fileId: string) => void
  lastElementRef?: (node: HTMLDivElement | null) => void
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  files,
  isLoading,
  isLoadingMore,
  isSelectMode,
  selectedIds,
  toggleFileSelection,
  setActiveMediaIndex,
  toggleFavorite,
  handleShare,
  resolveThumbnailUrl,
  onPrefetchUrl,
  lastElementRef,
}) => {
  const isVideo = (mimeType: string) => mimeType.startsWith('video/')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number, fileId: string) => {
    const cards = document.querySelectorAll<HTMLDivElement>('.media-card')
    if (cards.length === 0) return

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextCard = cards[index + 1]
      nextCard?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevCard = cards[index - 1]
      prevCard?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      let columnsCount = 1
      if (cards.length > 1) {
        const firstTop = cards[0].getBoundingClientRect().top
        for (let i = 1; i < cards.length; i++) {
          if (cards[i].getBoundingClientRect().top > firstTop) {
            columnsCount = i
            break
          }
        }
      }
      const nextCard = cards[index + columnsCount]
      nextCard?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      let columnsCount = 1
      if (cards.length > 1) {
        const firstTop = cards[0].getBoundingClientRect().top
        for (let i = 1; i < cards.length; i++) {
          if (cards[i].getBoundingClientRect().top > firstTop) {
            columnsCount = i
            break
          }
        }
      }
      const prevCard = cards[index - columnsCount]
      prevCard?.focus()
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      toggleFileSelection(fileId)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isSelectMode) {
        toggleFileSelection(fileId)
      } else {
        setActiveMediaIndex(index)
      }
    }
  }

  if (isLoading && files.length === 0) {
    return (
      <div className="gallery-grid">
        {Array.from({ length: 12 }).map((_, idx) => {
          const aspectRatios = ['1/1', '16/9', '4/5', '3/2', '4/3', '1/1', '16/9', '3/2', '4/3', '4/5', '1/1', '3/2']
          const aspect = aspectRatios[idx % aspectRatios.length]
          const isVid = idx % 3 === 0
          return (
            <div key={idx} className="media-card skeleton">
              <div className="skeleton-thumb" style={{ aspectRatio: aspect }}>
                {isVid && (
                  <div className="skeleton-video-play">
                    <Play size={18} className="fill-white text-white opacity-60" />
                  </div>
                )}
              </div>
              <div className="skeleton-meta" />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`gallery-grid-wrapper ${isLoading ? 'gallery-updating' : ''}`}>
      <div className="gallery-grid">
        {files.map((file, index) => {
          const isLast = index === files.length - 1
          const thumbUrl = resolveThumbnailUrl ? resolveThumbnailUrl(file) : (file.thumbnailUrl || '')
          return (
            <div
              key={file.id}
              ref={isLast ? lastElementRef : null}
              className={`media-card ${isSelectMode && selectedIds.has(file.id) ? 'selected' : ''}`}
              onClick={() => isSelectMode ? toggleFileSelection(file.id) : setActiveMediaIndex(index)}
              onKeyDown={(e) => handleKeyDown(e, index, file.id)}
              onMouseEnter={() => {
                // Hover prefetching: resolve the high-res URL so it's cached before click
                if (!isSelectMode && onPrefetchUrl) {
                  onPrefetchUrl(file.id)
                }
              }}
              tabIndex={0}
            >
              <div className="media-preview-wrapper">
                {/* Selection checkbox */}
                {isSelectMode && (
                  <button
                    className={`card-select-checkbox ${selectedIds.has(file.id) ? 'checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFileSelection(file.id, e)
                    }}
                    aria-label={selectedIds.has(file.id) ? 'Deselect' : 'Select'}
                  >
                    {selectedIds.has(file.id) && <Check size={12} strokeWidth={3} className="text-white" />}
                  </button>
                )}
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={file.originalName}
                    loading="lazy"
                    className="media-thumbnail"
                  />
                ) : (
                  <div className="media-icon-placeholder">
                    {isVideo(file.mimeType) ? (
                      <Film size={36} className="text-zinc-400" />
                    ) : (
                      <ImageIcon size={36} className="text-zinc-400" />
                    )}
                  </div>
                )}
                {isVideo(file.mimeType) && (
                  <div className="video-badge">
                    <span className="play-icon flex items-center justify-center">
                      <Play size={12} className="text-white fill-current" />
                    </span>
                  </div>
                )}
                
                {toggleFavorite && (
                  <button
                    className={`card-favorite-btn ${file.isFavorite ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(file.id, index, e)
                    }}
                    title={file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star size={16} className={file.isFavorite ? 'fill-current' : ''} />
                  </button>
                )}
                <button
                  className="card-download-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(`/api/files/${file.id}/download`)
                  }}
                  title="Download file"
                >
                  <Download size={16} />
                </button>
                {handleShare && (
                  <button
                    className="card-share-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShare(file.id, e)
                    }}
                    title="Share file"
                  >
                    <Link size={16} />
                  </button>
                )}
              </div>
              <div className="media-info">
                <span className="media-title" title={file.originalName}>
                  {file.originalName}
                </span>
                <span className="media-size">{formatBytes(file.fileSize)}</span>
              </div>
            </div>
          )
        })}
        
        {isLoadingMore && Array.from({ length: 4 }).map((_, idx) => {
          const aspectRatios = ['1/1', '16/9', '4/3', '3/2']
          const aspect = aspectRatios[idx % aspectRatios.length]
          const isVid = idx % 2 === 0
          return (
            <div key={`more-skeleton-${idx}`} className="media-card skeleton">
              <div className="skeleton-thumb" style={{ aspectRatio: aspect }}>
                {isVid && (
                  <div className="skeleton-video-play">
                    <Play size={18} className="fill-white text-white opacity-60" />
                  </div>
                )}
              </div>
              <div className="skeleton-meta" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
