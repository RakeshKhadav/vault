'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import Link from 'next/link'

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

interface UserProfile {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
  createdAt: string
  storageUsedBytes: string
  filesCount: number
}

type Params = Promise<{ userId: string }>

export default function AdminUserGalleryPage(props: { params: Params }) {
  const { userId } = use(props.params)

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

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

  // Share Modal State
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  // Filters Collapsible State (Mobile)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Selection Mode State
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDownloading, setIsBulkDownloading] = useState(false)

  const observerRef = useRef<IntersectionObserver | null>(null)

  // Fetch user profile info
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/admin/users/${userId}`)
        if (!res.ok) {
          if (res.status === 403) {
            setProfileError('Access denied. Admin role required.')
          } else {
            setProfileError('Failed to load user profile details.')
          }
          return
        }
        const data = await res.json()
        setUserProfile(data)
      } catch {
        setProfileError('Error fetching user profile.')
      }
    }
    fetchProfile()
  }, [userId])

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

  // Clear selection when leaving select mode or when filters change
  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const toggleFileSelection = useCallback((fileId: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(files.map((f) => f.id)))
  }, [files])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return
    setIsBulkDownloading(true)
    try {
      const res = await fetch('/api/files/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error('Failed to generate download links')
      const data = await res.json()

      // Stagger opening download links to avoid browser popup blocking
      for (const dl of data.downloads) {
        const a = document.createElement('a')
        a.href = dl.url
        a.download = ''
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // Small delay to avoid browser throttling multiple downloads
        await new Promise((r) => setTimeout(r, 300))
      }
    } catch (err) {
      console.error('Bulk download failed:', err)
      alert('Failed to download selected files. Please try again.')
    } finally {
      setIsBulkDownloading(false)
    }
  }, [selectedIds])

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Fetch initial files for target user
  const fetchFiles = useCallback(async (isFirstLoad = true, currentCursor: string | null = null) => {
    if (isFirstLoad) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const params = new URLSearchParams()
      params.append('limit', '24')
      params.append('userId', userId) // Route files scoped to this user
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
  }, [userId, typeFilter, debouncedSearch, startDate, endDate])

  // Reload list when filters change; also clear selection
  useEffect(() => {
    fetchFiles(true, null)
    setSelectedIds(new Set())
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

  // Toggling favorite (works since API allows admin bypass)
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
    if (!confirm('Are you sure you want to move this user\'s file to trash?')) return

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

  const handleShare = async (fileId: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    setIsSharing(true)
    try {
      const res = await fetch(`/api/files/${fileId}/share`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to generate share link')
      const data = await res.json()
      setShareUrl(data.url)
      setIsShareModalOpen(true)
    } catch (err) {
      console.error(err)
      alert('Failed to generate share link.')
    } finally {
      setIsSharing(false)
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

  const activeMedia = activeMediaIndex !== null ? files[activeMediaIndex] : null

  if (profileError) {
    return (
      <div className="page-container">
        <div className="auth-alert error">
          <span>⚠️</span> {profileError}
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <Link href="/admin/users" className="btn-admin-nav" style={{ display: 'inline-block', textDecoration: 'none' }}>
            ← Back to System Users
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Sub Header for Admin Mode */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="admin-badge role-admin" style={{ display: 'inline-block', marginBottom: '0.25rem', fontSize: '0.625rem' }}>
            ADMIN ACCESS MODE
          </span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '500', margin: 0 }}>
            {userProfile ? `Viewing Gallery: ${userProfile.email}` : 'Loading User Gallery...'}
          </h2>
        </div>
        <Link href="/admin/users" className="btn-admin-nav" style={{ display: 'inline-block', textDecoration: 'none', fontSize: '0.8125rem' }}>
          ← Back to System Users
        </Link>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="gallery-toolbar">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search user media..."
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

        <div className="toolbar-divider" />

        {/* Select Mode Toggle */}
        <button
          className={`select-mode-btn ${isSelectMode ? 'active' : ''}`}
          onClick={() => isSelectMode ? exitSelectMode() : setIsSelectMode(true)}
        >
          {isSelectMode ? '✕ Cancel' : '☐ Select'}
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {isSelectMode && (
        <div className="bulk-actions-bar">
          <div className="bulk-actions-left">
            <button className="bulk-action-link" onClick={selectedIds.size === files.length ? deselectAll : selectAll}>
              {selectedIds.size === files.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="bulk-count">{selectedIds.size} selected</span>
          </div>
          <div className="bulk-actions-right">
            <button
              className="bulk-download-btn"
              disabled={selectedIds.size === 0 || isBulkDownloading}
              onClick={handleBulkDownload}
            >
              {isBulkDownloading ? (
                <><span className="btn-spinner" /> Downloading...</>
              ) : (
                <>📥 Download {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Media Grid */}
      {isLoading && files.length === 0 ? (
        <div className="gallery-grid">
          {Array.from({ length: 12 }).map((_, idx) => {
            const aspectRatios = ['1/1', '16/9', '4/5', '3/2', '4/3', '1/1', '16/9', '3/2']
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
          <h2>This gallery is empty.</h2>
          <p className="placeholder-description">
            {searchQuery || typeFilter !== 'all'
              ? 'No matching memories found in this user\'s index.'
              : 'This user has not preserved any media items yet.'}
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
                  className={`media-card ${isSelectMode && selectedIds.has(file.id) ? 'selected' : ''}`}
                  onClick={() => isSelectMode ? toggleFileSelection(file.id) : setActiveMediaIndex(index)}
                >
                  <div className="media-preview-wrapper">
                    {/* Selection checkbox */}
                    {isSelectMode && (
                      <button
                        className={`card-select-checkbox ${selectedIds.has(file.id) ? 'checked' : ''}`}
                        onClick={(e) => toggleFileSelection(file.id, e)}
                        aria-label={selectedIds.has(file.id) ? 'Deselect' : 'Select'}
                      >
                        {selectedIds.has(file.id) ? '✓' : ''}
                      </button>
                    )}
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
                    <button
                      className="card-share-btn"
                      onClick={(e) => handleShare(file.id, e)}
                      title="Share file"
                    >
                      🔗
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
            
            <div className={`viewer-footer ${showDetails ? 'open' : ''}`}>
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
                  ★ <span className="btn-label">{activeMedia.isFavorite ? 'Favorited' : 'Favorite'}</span>
                </button>
                <button
                  className="viewer-download-btn"
                  onClick={() => window.open(`/api/files/${activeMedia.id}/download`)}
                  title="Download file"
                >
                  📥 <span className="btn-label">Download</span>
                </button>
                <button
                  className="viewer-share-btn"
                  onClick={(e) => handleShare(activeMedia.id, e)}
                  title="Share file"
                >
                  🔗 <span className="btn-label">Share</span>
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

      {/* Share Link Modal Overlay */}
      {isShareModalOpen && shareUrl && (
        <div className="modal-overlay" onClick={() => setIsShareModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3>Temporary Share Link</h3>
              <button className="btn-close" onClick={() => setIsShareModalOpen(false)}>✕</button>
            </div>
            <p style={{ color: '#8f95a3', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
              Anyone with this link can view and download the file. This link will expire in 15 minutes.
            </p>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                readOnly
                value={shareUrl}
                style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(255, 255, 255, 0.1)', width: '100%', padding: '0.5rem' }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>
            <button
              className="btn-submit"
              style={{ width: '100%' }}
              onClick={() => {
                navigator.clipboard.writeText(shareUrl)
                alert('Copied to clipboard!')
              }}
            >
              Copy Link to Clipboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
