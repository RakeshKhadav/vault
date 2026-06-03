import React from 'react'
import { useTouchGestures } from '@/lib/hooks/useTouchGestures'
import { formatBytes } from '@/lib/utils/format'

export interface MediaFile {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: string
  uploadedAt: string
  thumbnailUrl?: string | null
  viewUrl?: string | null
  streamUrl?: string | null
  isFavorite?: boolean
}

export interface MediaViewerProps {
  activeMediaIndex: number | null
  files: MediaFile[]
  resolvedUrls: Record<string, { viewUrl?: string | null; previewUrl?: string | null; streamUrl?: string | null }>
  highResLoaded: boolean
  setHighResLoaded: (val: boolean) => void
  showDetails: boolean
  setShowDetails: (val: boolean) => void
  handlePrev: () => void
  handleNext: () => void
  handleClose: () => void
  onToggleFavorite?: (id: string, index: number, event?: React.MouseEvent) => void
  onDownload?: (file: MediaFile, event?: React.MouseEvent) => void
  onShare?: (id: string, event?: React.MouseEvent) => void
  onDelete?: (id: string, index: number, event?: React.MouseEvent) => void
  resolveThumbnailUrl?: (file: MediaFile) => string
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  activeMediaIndex,
  files,
  resolvedUrls,
  highResLoaded,
  setHighResLoaded,
  showDetails,
  setShowDetails,
  handlePrev,
  handleNext,
  handleClose,
  onToggleFavorite,
  onDownload,
  onShare,
  onDelete,
  resolveThumbnailUrl,
}) => {
  const activeMedia = activeMediaIndex !== null ? files[activeMediaIndex] : null
  const filesLength = files.length

  const {
    zoomScale,
    panOffset,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMediaTap,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
  } = useTouchGestures({
    activeMediaIndex,
    filesLength,
    handlePrev,
    handleNext,
    handleClose,
  })

  if (!activeMedia) return null

  const isVideo = activeMedia.mimeType.startsWith('video/')
  const thumbUrl = resolveThumbnailUrl ? resolveThumbnailUrl(activeMedia) : (activeMedia.thumbnailUrl || '')
  const displayUrl = isVideo 
    ? (resolvedUrls[activeMedia.id]?.streamUrl || undefined) 
    : (resolvedUrls[activeMedia.id]?.previewUrl || resolvedUrls[activeMedia.id]?.viewUrl || thumbUrl)

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (showDetails) {
      setShowDetails(false)
    } else {
      handleClose()
    }
  }

  const defaultOnDownload = () => {
    window.open(`/api/files/${activeMedia.id}/download`)
  }

  return (
    <div className="viewer-overlay" onClick={handleOverlayClick}>
      <button className="viewer-close-btn" onClick={handleClose} aria-label="Close viewer">
        ✕
      </button>
      
      <button className="viewer-more-btn" onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }} aria-label="Toggle details">
        ⋮
      </button>
      
      <button className="viewer-nav-btn prev" onClick={handlePrev} aria-label="Previous">
        ‹
      </button>
      <button className="viewer-nav-btn next" onClick={handleNext} aria-label="Next">
        ›
      </button>

      <div
        className="viewer-content-wrapper"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="viewer-media-container"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleMediaTap}
          onWheel={handleWheel}
        >
          {isVideo ? (
            <video
              src={displayUrl}
              controls
              autoPlay
              muted
              playsInline
              poster={thumbUrl || undefined}
              className="viewer-video"
              style={{
                transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
                transition: isDragging.current 
                  ? 'filter 0.3s ease-in-out' 
                  : 'transform 0.2s ease-in-out, filter 0.3s ease-in-out',
                cursor: zoomScale > 1 ? 'grab' : 'zoom-in',
                touchAction: 'none',
                filter: highResLoaded ? 'none' : 'blur(8px)'
              }}
              onLoadedData={() => {
                if (resolvedUrls[activeMedia.id]?.streamUrl) {
                  setHighResLoaded(true)
                }
              }}
            />
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', position: 'relative', width: '100%', height: '100%' }}>
              {/* Thumbnail Placeholder (loaded instantly from browser cache) */}
              {!highResLoaded && thumbUrl && (
                <img
                  src={thumbUrl}
                  alt={activeMedia.originalName}
                  className="viewer-image"
                  style={{
                    gridArea: '1 / 1',
                    filter: 'blur(8px)',
                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
                    transition: isDragging.current 
                      ? 'none' 
                      : 'transform 0.2s ease-in-out',
                    cursor: zoomScale > 1 ? 'grab' : 'zoom-in',
                    touchAction: 'none',
                    zIndex: 1,
                  }}
                />
              )}
              {/* High-res Image (fades in smoothly over the thumbnail placeholder) */}
              <img
                src={displayUrl}
                alt={activeMedia.originalName}
                className="viewer-image"
                style={{
                  gridArea: '1 / 1',
                  opacity: highResLoaded ? 1 : 0.01,
                  transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
                  transition: isDragging.current 
                    ? 'opacity 0.2s ease-in-out' 
                    : 'transform 0.2s ease-in-out, opacity 0.2s ease-in-out',
                  cursor: zoomScale > 1 ? 'grab' : 'zoom-in',
                  touchAction: 'none',
                  zIndex: 2,
                }}
                onLoad={() => {
                  if (resolvedUrls[activeMedia.id]?.previewUrl || resolvedUrls[activeMedia.id]?.viewUrl) {
                    setHighResLoaded(true)
                  }
                }}
              />
            </div>
          )}
        </div>
        
        <div className={`viewer-footer ${showDetails ? 'open' : ''}`}>
          <div className="viewer-meta">
            <h3 className="viewer-title">{activeMedia.originalName}</h3>
            <p className="viewer-subtitle">
              {formatBytes(activeMedia.fileSize)} • {new Date(activeMedia.uploadedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="viewer-actions">
            {onToggleFavorite && (
              <button
                className={`viewer-favorite-btn ${activeMedia.isFavorite ? 'active' : ''}`}
                onClick={(e) => onToggleFavorite(activeMedia.id, activeMediaIndex!, e)}
                title={activeMedia.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                ★ <span className="btn-label">{activeMedia.isFavorite ? 'Favorited' : 'Favorite'}</span>
              </button>
            )}
            <button
              className="viewer-download-btn"
              onClick={(e) => onDownload ? onDownload(activeMedia, e) : defaultOnDownload()}
              title="Download file"
            >
              📥 <span className="btn-label">Download</span>
            </button>
            {onShare && (
              <button
                className="viewer-share-btn"
                onClick={(e) => onShare(activeMedia.id, e)}
                title="Share file"
              >
                🔗 <span className="btn-label">Share</span>
              </button>
            )}
            {onDelete && (
              <button
                className="viewer-delete-btn"
                onClick={(e) => onDelete(activeMedia.id, activeMediaIndex!, e)}
                title="Move to trash"
              >
                🗑️ <span className="btn-label">Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
