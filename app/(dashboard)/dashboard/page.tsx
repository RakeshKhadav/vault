'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface MediaFile {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: string
  isFavorite: boolean
  thumbnailFileId: string | null
  uploadedAt: string
}

export default function GalleryPage() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Fullscreen Viewer State
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null)

  const observerRef = useRef<IntersectionObserver | null>(null)

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Fetch initial files
  const fetchFiles = useCallback(async (isFirstLoad = true, currentCursor: string | null = null) => {
    if (isFirstLoad) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const params = new URLSearchParams()
      params.append('limit', '24')
      if (typeFilter !== 'all') {
        params.append('type', typeFilter)
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch)
      }
      if (startDate) {
        params.append('startDate', startDate)
      }
      if (endDate) {
        params.append('endDate', endDate)
      }
      if (currentCursor) {
        params.append('cursor', currentCursor)
      }

      const res = await fetch(`/api/files?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch files')

      const data = await res.json()

      if (isFirstLoad) {
        setFiles(data.files)
      } else {
        setFiles((prev) => [...prev, ...data.files])
      }
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    } catch (err) {
      console.error('Error loading gallery files:', err)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [typeFilter, debouncedSearch, startDate, endDate])

  // Reload list when filters change
  useEffect(() => {
    fetchFiles(true, null)
  }, [fetchFiles])

  // Infinite scroll trigger
  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isLoadingMore) return
      if (observerRef.current) observerRef.current.disconnect()

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && cursor) {
          fetchFiles(false, cursor)
        }
      })

      if (node) observerRef.current.observe(node)
    },
    [isLoading, isLoadingMore, hasMore, cursor, fetchFiles]
  )

  const formatSize = (bytesStr: string) => {
    const bytes = parseInt(bytesStr, 10)
    if (isNaN(bytes)) return '0 B'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const isVideo = (mimeType: string) => mimeType.startsWith('video/')

  // Toggling favorite
  const toggleFavorite = async (fileId: string, index: number, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const file = files[index]
    if (!file) return

    const isCurrentlyFavorite = file.isFavorite

    // Optimistic UI update
    setFiles((prev) => {
      const updated = [...prev]
      updated[index] = { ...file, isFavorite: !isCurrentlyFavorite }
      return updated
    })

    try {
      const method = isCurrentlyFavorite ? 'DELETE' : 'POST'
      const res = await fetch(`/api/files/${fileId}/favorite`, { method })
      if (!res.ok) throw new Error('Failed to update favorite status')
    } catch (err) {
      console.error(err)
      // Revert optimistic update
      setFiles((prev) => {
        const reverted = [...prev]
        reverted[index] = { ...file, isFavorite: isCurrentlyFavorite }
        return reverted
      })
    }
  }

  const handleDelete = async (fileId: string, index: number, event?: React.MouseEvent) => {
    event?.stopPropagation()
    if (!confirm('Are you sure you want to move this file to trash?')) return

    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete file')

      setFiles((prev) => prev.filter((_, i) => i !== index))
      setActiveMediaIndex(null)
    } catch (err) {
      console.error(err)
      alert('Failed to delete file.')
    }
  }

  // Navigation handlers
  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (activeMediaIndex === null || files.length === 0) return
    setActiveMediaIndex((prev) => (prev === 0 ? files.length - 1 : prev! - 1))
  }, [activeMediaIndex, files])

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (activeMediaIndex === null || files.length === 0) return
    setActiveMediaIndex((prev) => (prev === files.length - 1 ? 0 : prev! + 1))
  }, [activeMediaIndex, files])

  const handleClose = useCallback(() => {
    setActiveMediaIndex(null)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (activeMediaIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeMediaIndex, handlePrev, handleNext, handleClose])

  const activeMedia = activeMediaIndex !== null ? files[activeMediaIndex] : null

  return (
    <div className="page-container">
      {/* Search and Filters Toolbar */}
      <div className="gallery-toolbar">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search media files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>

        <div className="date-filters">
          <div className="date-input-group">
            <span className="date-label">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="date-picker-input"
            />
          </div>
          <div className="date-input-group">
            <span className="date-label">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="date-picker-input"
            />
          </div>
          {(startDate || endDate) && (
            <button
              className="clear-dates-btn"
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        <div className="filter-tabs">
          <button
            className={`filter-tab ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All Media
          </button>
          <button
            className={`filter-tab ${typeFilter === 'image' ? 'active' : ''}`}
            onClick={() => setTypeFilter('image')}
          >
            Photos
          </button>
          <button
            className={`filter-tab ${typeFilter === 'video' ? 'active' : ''}`}
            onClick={() => setTypeFilter('video')}
          >
            Videos
          </button>
        </div>
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="gallery-grid">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="media-card skeleton">
              <div className="skeleton-thumb" />
              <div className="skeleton-meta" />
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="gallery-placeholder">
          <p className="placeholder-icon">📷</p>
          <h2>No media found</h2>
          <p className="placeholder-description">
            {searchQuery || typeFilter !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'Upload your photos and videos to see them here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="gallery-grid">
            {files.map((file, index) => {
              const isLast = index === files.length - 1
              return (
                <div
                  key={file.id}
                  ref={isLast ? lastElementRef : null}
                  className="media-card"
                  onClick={() => setActiveMediaIndex(index)}
                >
                  <div className="media-preview-wrapper">
                    {file.thumbnailFileId ? (
                      <img
                        src={`/api/files/${file.id}/thumbnail`}
                        alt={file.originalName}
                        loading="lazy"
                        className="media-thumbnail"
                      />
                    ) : (
                      <div className="media-icon-placeholder">
                        {isVideo(file.mimeType) ? '🎬' : '📷'}
                      </div>
                    )}
                    {isVideo(file.mimeType) && (
                      <div className="video-badge">
                        <span className="play-icon">▶</span>
                      </div>
                    )}
                    
                    <button
                      className={`card-favorite-btn ${file.isFavorite ? 'active' : ''}`}
                      onClick={(e) => toggleFavorite(file.id, index, e)}
                      title={file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      ★
                    </button>
                    <button
                      className="card-download-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(`/api/files/${file.id}/download`)
                      }}
                      title="Download file"
                    >
                      📥
                    </button>
                  </div>
                  <div className="media-info">
                    <span className="media-title" title={file.originalName}>
                      {file.originalName}
                    </span>
                    <span className="media-size">{formatSize(file.fileSize)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {isLoadingMore && (
            <div className="gallery-load-more-loader">
              <div className="spinner" />
              <span>Loading more items...</span>
            </div>
          )}
        </>
      )}

      {/* Fullscreen Media Viewer Modal */}
      {activeMedia && (
        <div className="viewer-overlay" onClick={handleClose}>
          <button className="viewer-close-btn" onClick={handleClose} aria-label="Close viewer">
            ✕
          </button>
          
          <button className="viewer-nav-btn prev" onClick={handlePrev} aria-label="Previous">
            ‹
          </button>
          <button className="viewer-nav-btn next" onClick={handleNext} aria-label="Next">
            ›
          </button>

          <div className="viewer-content-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="viewer-media-container">
              {isVideo(activeMedia.mimeType) ? (
                <video
                  src={`/api/files/${activeMedia.id}/stream`}
                  controls
                  autoPlay
                  className="viewer-video"
                />
              ) : (
                <img
                  src={`/api/files/${activeMedia.id}/view`}
                  alt={activeMedia.originalName}
                  className="viewer-image"
                />
              )}
            </div>
            
            <div className="viewer-footer">
              <div className="viewer-meta">
                <h3 className="viewer-title">{activeMedia.originalName}</h3>
                <p className="viewer-subtitle">
                  {formatSize(activeMedia.fileSize)} • {new Date(activeMedia.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="viewer-actions">
                <button
                  className={`viewer-favorite-btn ${activeMedia.isFavorite ? 'active' : ''}`}
                  onClick={(e) => toggleFavorite(activeMedia.id, activeMediaIndex!, e)}
                  title={activeMedia.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  ★ {activeMedia.isFavorite ? 'Favorited' : 'Favorite'}
                </button>
                <button
                  className="viewer-download-btn"
                  onClick={() => window.open(`/api/files/${activeMedia.id}/download`)}
                  title="Download file"
                >
                  📥 Download
                </button>
                <button
                  className="viewer-delete-btn"
                  onClick={(e) => handleDelete(activeMedia.id, activeMediaIndex!, e)}
                  title="Move to trash"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
