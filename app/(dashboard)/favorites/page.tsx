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
  thumbnailUrl?: string | null
  viewUrl?: string | null
  streamUrl?: string | null
}

export default function FavoritesPage() {
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
  const [datePreset, setDatePreset] = useState<'anytime' | 'today' | 'week' | 'month' | 'year'>('anytime')

  // Fullscreen Viewer State
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // Filters Collapsible State (Mobile)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const observerRef = useRef<IntersectionObserver | null>(null)

  // Apply date preset
  const applyDatePreset = (preset: 'anytime' | 'today' | 'week' | 'month' | 'year') => {
    setDatePreset(preset)
    const now = new Date()
    
    if (preset === 'anytime') {
      setStartDate('')
      setEndDate('')
    } else if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0]
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (preset === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      setStartDate(oneWeekAgo.toISOString().split('T')[0])
      setEndDate(now.toISOString().split('T')[0])
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      setStartDate(firstDay.toISOString().split('T')[0])
      setEndDate(now.toISOString().split('T')[0])
    } else if (preset === 'year') {
      const firstDayOfYear = new Date(now.getFullYear(), 0, 1)
      setStartDate(firstDayOfYear.toISOString().split('T')[0])
      setEndDate(now.toISOString().split('T')[0])
    }
  }

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Fetch initial files (favorites only)
  const fetchFiles = useCallback(async (isFirstLoad = true, currentCursor: string | null = null) => {
    if (isFirstLoad) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const params = new URLSearchParams()
      params.append('limit', '24')
      params.append('favorite', 'true') // Hardcoded to fetch favorites
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
      console.error('Error loading favorites files:', err)
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

    // Since we are on the Favorites page, toggle means removing it from the view
    setFiles((prev) => prev.filter((_, i) => i !== index))
    
    if (activeMediaIndex === index) {
      setActiveMediaIndex(null)
    } else if (activeMediaIndex !== null && activeMediaIndex > index) {
      setActiveMediaIndex((prev) => prev! - 1)
    }

    try {
      const res = await fetch(`/api/files/${fileId}/favorite`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove from favorites')
    } catch (err) {
      console.error(err)
      // On error, reload full list to recover state
      fetchFiles(true, null)
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
    setShowDetails(false)
  }, [activeMediaIndex, files])

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (activeMediaIndex === null || files.length === 0) return
    setActiveMediaIndex((prev) => (prev === files.length - 1 ? 0 : prev! + 1))
    setShowDetails(false)
  }, [activeMediaIndex, files])

  const handleClose = useCallback(() => {
    setActiveMediaIndex(null)
    setShowDetails(false)
  }, [])

  const handleOverlayClick = useCallback(() => {
    if (showDetails) {
      setShowDetails(false)
    } else {
      handleClose()
    }
  }, [showDetails, handleClose])

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

  // CLIENT-SIDE VISUAL ANTICIPATION: Silently preload next and previous high-resolution images
  useEffect(() => {
    if (activeMediaIndex === null || files.length === 0) return

    const preloadImage = (url: string) => {
      const img = new Image()
      img.src = url
    }

    // Preload previous image
    const prevIndex = activeMediaIndex === 0 ? files.length - 1 : activeMediaIndex - 1
    const prevFile = files[prevIndex]
    if (prevFile && prevFile.viewUrl && prevFile.mimeType.startsWith('image/')) {
      preloadImage(prevFile.viewUrl)
    }

    // Preload next image
    const nextIndex = activeMediaIndex === files.length - 1 ? 0 : activeMediaIndex + 1
    const nextFile = files[nextIndex]
    if (nextFile && nextFile.viewUrl && nextFile.mimeType.startsWith('image/')) {
      preloadImage(nextFile.viewUrl)
    }
  }, [activeMediaIndex, files])

  const activeMedia = activeMediaIndex !== null ? files[activeMediaIndex] : null

  return (
    <div className="page-container">
      {/* Search and Filters Toolbar */}
      <div className="gallery-toolbar">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search favorites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Small filters toggle button on mobile */}
        <button
          className={`filter-toggle-btn ${filtersOpen ? 'active' : ''}`}
          onClick={() => setFiltersOpen(!filtersOpen)}
          aria-label="Toggle filters"
        >
          🎛️ Filters
        </button>

        <div className={`gallery-filters-collapsible ${filtersOpen ? 'open' : ''}`}>
          <div className="toolbar-divider" />

          <div className="filter-tabs">
            <button
              className={`filter-tab ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              All
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

          <div className="toolbar-divider" />

          <div className="date-presets">
            {(['anytime', 'today', 'week', 'month', 'year'] as const).map((preset) => (
              <button
                key={preset}
                className={`preset-tab ${datePreset === preset ? 'active' : ''}`}
                onClick={() => applyDatePreset(preset)}
              >
                {preset === 'anytime' ? 'Anytime' : preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : preset === 'year' ? 'This Year' : 'Today'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Media Grid */}
      {isLoading && files.length === 0 ? (
        <div className="gallery-grid">
          {Array.from({ length: 12 }).map((_, idx) => {
            const aspectRatios = ['1/1', '16/9', '4/5', '3/2', '4/3', '1/1', '16/9', '3/2', '4/3', '4/5', '1/1', '3/2']
            const aspect = aspectRatios[idx % aspectRatios.length]
            const isVideo = idx % 3 === 0
            return (
              <div key={idx} className="media-card skeleton">
                <div className="skeleton-thumb" style={{ aspectRatio: aspect }}>
                  {isVideo && (
                    <div className="skeleton-video-play">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="9,6 19,12 9,18" fill="#FFFFFF" opacity="0.6" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="skeleton-meta" />
              </div>
            )
          })}
        </div>
      ) : files.length === 0 ? (
        <div className="gallery-placeholder">
          <p className="placeholder-icon">⊙</p>
          <h2>The gallery is quiet.</h2>
          <p className="placeholder-description">
            {searchQuery || typeFilter !== 'all' || startDate || endDate
              ? 'No matching favorited files found in the archive.'
              : 'Add stars to your favorite memories to collect them in this exhibit.'}
          </p>
        </div>
      ) : (
        <div className={`gallery-grid-wrapper ${isLoading ? 'gallery-updating' : ''}`}>
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
                    {file.thumbnailUrl ? (
                      <img
                        src={file.thumbnailUrl}
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
                      className="card-favorite-btn active"
                      onClick={(e) => toggleFavorite(file.id, index, e)}
                      title="Remove from favorites"
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

            {isLoadingMore && Array.from({ length: 4 }).map((_, idx) => {
              const aspectRatios = ['1/1', '16/9', '4/3', '3/2']
              const aspect = aspectRatios[idx % aspectRatios.length]
              const isVideo = idx % 2 === 0
              return (
                <div key={`more-skeleton-${idx}`} className="media-card skeleton">
                  <div className="skeleton-thumb" style={{ aspectRatio: aspect }}>
                    {isVideo && (
                      <div className="skeleton-video-play">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <polygon points="9,6 19,12 9,18" fill="#FFFFFF" opacity="0.6" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="skeleton-meta" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Fullscreen Media Viewer Modal */}
      {activeMedia && (
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

          <div className="viewer-content-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="viewer-media-container">
              {isVideo(activeMedia.mimeType) ? (
                <video
                  src={activeMedia.streamUrl || `/api/files/${activeMedia.id}/stream`}
                  controls
                  autoPlay
                  className="viewer-video"
                />
              ) : (
                <img
                  src={activeMedia.viewUrl || `/api/files/${activeMedia.id}/view`}
                  alt={activeMedia.originalName}
                  className="viewer-image"
                />
              )}
            </div>
            
            <div className={`viewer-footer ${showDetails ? 'open' : ''}`}>
              <div className="viewer-meta">
                <h3 className="viewer-title">{activeMedia.originalName}</h3>
                <p className="viewer-subtitle">
                  {formatSize(activeMedia.fileSize)} • {new Date(activeMedia.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="viewer-actions">
                <button
                  className="viewer-favorite-btn active"
                  onClick={(e) => toggleFavorite(activeMedia.id, activeMediaIndex!, e)}
                  title="Remove from favorites"
                >
                  ★ <span className="btn-label">Favorited</span>
                </button>
                <button
                  className="viewer-download-btn"
                  onClick={() => window.open(`/api/files/${activeMedia.id}/download`)}
                  title="Download file"
                >
                  📥 <span className="btn-label">Download</span>
                </button>
                <button
                  className="viewer-delete-btn"
                  onClick={(e) => handleDelete(activeMedia.id, activeMediaIndex!, e)}
                  title="Move to trash"
                >
                  🗑️ <span className="btn-label">Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
