'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import Link from 'next/link'
import { useMediaViewer } from '@/lib/hooks/useMediaViewer'
import { useModal } from '@/components/ModalProvider'
import { MediaViewer } from '@/components/gallery/MediaViewer'
import { MediaGrid } from '@/components/gallery/MediaGrid'
import { GalleryToolbar } from '@/components/gallery/GalleryToolbar'
import { formatBytes as formatSize } from '@/lib/utils/format'
import {
  Lock,
  ArrowLeft,
  X,
  CheckSquare,
  Download,
  Trash2,
  FolderOpen
} from 'lucide-react'

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
  const { alert } = useModal()

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

  // Share Modal State
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  // Selection Mode State
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDownloading, setIsBulkDownloading] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
  })

  const openConfirmModal = (title: string, message: string, confirmText: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm,
    })
  }

  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastSelectedIndex = useRef<number | null>(null)

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
        setUserProfile(data.user)
      } catch {
        setProfileError('Network error loading user profile.')
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
    lastSelectedIndex.current = null
  }, [])

  const toggleFileSelection = useCallback((fileId: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const currentIndex = files.findIndex((f) => f.id === fileId)
    if (currentIndex === -1) return
    
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (event?.shiftKey && lastSelectedIndex.current !== null) {
        const start = Math.min(lastSelectedIndex.current, currentIndex)
        const end = Math.max(lastSelectedIndex.current, currentIndex)
        const shouldSelect = !prev.has(fileId)
        for (let i = start; i <= end; i++) {
          const file = files[i]
          if (file) {
            if (shouldSelect) next.add(file.id)
            else next.delete(file.id)
          }
        }
      } else {
        if (next.has(fileId)) {
          next.delete(fileId)
        } else {
          next.add(fileId)
        }
      }
      return next
    })
    lastSelectedIndex.current = currentIndex
  }, [files])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(files.map((f) => f.id)))
  }, [files])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
    lastSelectedIndex.current = null
  }, [])

  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return
    setIsBulkDownloading(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      const promises = Array.from(selectedIds).map(async (id) => {
        const fileObj = files.find((f) => f.id === id)
        const name = fileObj ? fileObj.originalName : `file-${id}`
        const fileRes = await fetch(`/api/files/${id}/download`)
        if (!fileRes.ok) throw new Error(`Failed to download file: ${name}`)
        const blob = await fileRes.blob()
        zip.file(name, blob)
      })

      await Promise.all(promises)
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = window.URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vault-export-${Date.now()}.zip`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Bulk download failed:', err)
      await alert('Failed to download selected files. Please try again.')
    } finally {
      setIsBulkDownloading(false)
    }
  }, [selectedIds, files])

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return
    openConfirmModal(
      'Move Selected Files to Trash',
      `Are you sure you want to move the ${selectedIds.size} selected files to trash?`,
      'Move to Trash',
      async () => {
        setIsBulkDeleting(true)
        try {
          const res = await fetch('/api/files/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileIds: Array.from(selectedIds) }),
          })
          if (!res.ok) throw new Error('Failed to delete selected files')
          setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)))
          exitSelectMode()
        } catch (err) {
          console.error('Bulk delete failed:', err)
          await alert('Failed to delete selected files.')
        } finally {
          setIsBulkDeleting(false)
        }
      }
    )
  }, [selectedIds, exitSelectMode, alert])

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
    lastSelectedIndex.current = null
  }, [fetchFiles])

  const lastLoadedRef = useRef(Date.now())

  useEffect(() => {
    lastLoadedRef.current = Date.now()
  }, [files])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const ageMs = Date.now() - lastLoadedRef.current
        if (ageMs > 45 * 60 * 1000) {
          fetchFiles(true, null)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    const interval = setInterval(() => {
      const ageMs = Date.now() - lastLoadedRef.current
      if (ageMs > 45 * 60 * 1000) {
        fetchFiles(true, null)
      }
    }, 5 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
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

  const viewer = useMediaViewer({ files })

  useEffect(() => {
    if (!isSelectMode || viewer.activeMediaIndex !== null) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); exitSelectMode() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll() }
      if (e.key === 'Delete') { e.preventDefault(); handleBulkDelete() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelectMode, viewer.activeMediaIndex, exitSelectMode, selectAll, handleBulkDelete])

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

  const handleDelete = (fileId: string, index: number, event?: React.MouseEvent) => {
    event?.stopPropagation()
    openConfirmModal(
      'Move File to Trash',
      "Are you sure you want to move this user's file to trash?",
      'Move to Trash',
      async () => {
        try {
          const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete file')

          setFiles((prev) => prev.filter((_, i) => i !== index))
          viewer.setActiveMediaIndex(null)
        } catch (err) {
          console.error(err)
          await alert('Failed to delete file.')
        }
      }
    )
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
      await alert('Failed to generate share link.')
    } finally {
      setIsSharing(false)
    }
  }



  if (profileError) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <Lock size={48} className="text-red-500 mb-2 shrink-0 animate-pulse" />
        <h2>Access Denied</h2>
        <p style={{ color: '#8f95a3' }}>{profileError}</p>
        <Link href="/admin/users" className="btn-submit flex items-center justify-center gap-1.5" style={{ display: 'inline-flex', marginTop: '1rem', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Users
        </Link>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header Profile section */}
      {userProfile && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Link href="/admin/users" className="flex items-center gap-1" style={{ textDecoration: 'none', color: '#3b82f6', fontSize: '0.875rem' }}>
                <ArrowLeft size={14} /> Users
              </Link>
              <span style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '0.875rem' }}>/</span>
              <span style={{ color: '#8f95a3', fontSize: '0.875rem' }}>Gallery</span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
              {userProfile.email}
            </h1>
            <p style={{ color: '#8f95a3', fontSize: '0.8125rem', margin: '0.25rem 0 0 0' }}>
              Joined on {new Date(userProfile.createdAt).toLocaleDateString()} • Role: {userProfile.role}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', color: '#8f95a3', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preserved Files</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff' }}>{userProfile.filesCount}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', color: '#8f95a3', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Storage Used</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff' }}>{formatSize(userProfile.storageUsedBytes)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Toolbar Component */}
      <GalleryToolbar
        searchPlaceholder="Search user media..."
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={(type) => setTypeFilter(type)}
        datePreset={datePreset}
        onDatePresetChange={(preset) => applyDatePreset(preset)}
        extraActions={
          <button
            className={`select-mode-btn ${isSelectMode ? 'active' : ''} flex items-center justify-center`}
            onClick={() => isSelectMode ? exitSelectMode() : setIsSelectMode(true)}
            aria-label={isSelectMode ? 'Cancel Selection' : 'Select Files'}
          >
            {isSelectMode ? (
              <span className="flex items-center gap-1.5"><X size={14} /> <span className="btn-label-text">Cancel</span></span>
            ) : (
              <span className="flex items-center gap-1.5"><CheckSquare size={14} /> <span className="btn-label-text">Select</span></span>
            )}
          </button>
        }
      />

      {/* Bulk Actions Bar */}
      {isSelectMode && (
        <div className="bulk-actions-bar">
          <div className="bulk-actions-left">
            <button className="bulk-action-link" onClick={selectedIds.size === files.length ? deselectAll : selectAll}>
              {selectedIds.size === files.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="bulk-selection-count">
              {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'} selected
            </span>
          </div>
          <div className="bulk-actions-right">
            <button 
              className="bulk-download-btn"
              disabled={selectedIds.size === 0 || isBulkDownloading}
              onClick={handleBulkDownload}
            >
              {isBulkDownloading ? 'Downloading...' : (
                <span className="flex items-center gap-1.5"><Download size={14} /> Download Selected</span>
              )}
            </button>
            <button 
              className="bulk-delete-btn"
              disabled={selectedIds.size === 0 || isBulkDeleting}
              onClick={handleBulkDelete}
            >
              {isBulkDeleting ? 'Deleting...' : (
                <span className="flex items-center gap-1.5"><Trash2 size={14} /> Delete Selected</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Media Grid Placeholder / Grid */}
      {files.length === 0 && !isLoading ? (
        <div className="gallery-placeholder">
          <FolderOpen size={48} className="text-zinc-500 mb-4 opacity-50 shrink-0" />
          <h2>The archive is quiet.</h2>
          <p className="placeholder-description">
            {searchQuery || typeFilter !== 'all' || startDate || endDate
              ? 'No matching files found in this user\'s archive.'
              : 'This user hasn\'t preserved any files yet.'}
          </p>
        </div>
      ) : (
        <MediaGrid
          files={files}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          isSelectMode={isSelectMode}
          selectedIds={selectedIds}
          toggleFileSelection={toggleFileSelection}
          setActiveMediaIndex={viewer.setActiveMediaIndex}
          toggleFavorite={toggleFavorite}
          handleShare={handleShare}
          onPrefetchUrl={viewer.prefetchUrl}
          lastElementRef={lastElementRef}
        />
      )}

      {/* Fullscreen Media Viewer Modal Component */}
      <MediaViewer
        activeMediaIndex={viewer.activeMediaIndex}
        files={files}
        resolvedUrls={viewer.resolvedUrls}
        highResLoaded={viewer.highResLoaded}
        setHighResLoaded={viewer.setHighResLoaded}
        showDetails={viewer.showDetails}
        setShowDetails={viewer.setShowDetails}
        handlePrev={viewer.handlePrev}
        handleNext={viewer.handleNext}
        handleClose={viewer.handleClose}
        onToggleFavorite={toggleFavorite}
        onShare={handleShare}
        onDelete={handleDelete}
      />

      {/* Share Link Modal Overlay */}
      {isShareModalOpen && shareUrl && (
        <div className="modal-overlay" onClick={() => setIsShareModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3>Temporary Share Link</h3>
              <button className="btn-close flex items-center justify-center" onClick={() => setIsShareModalOpen(false)} aria-label="Close modal">
                <X size={16} />
              </button>
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
              onClick={async () => {
                navigator.clipboard.writeText(shareUrl)
                await alert('Copied to clipboard!', 'Success')
              }}
            >
              Copy Link to Clipboard
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay confirm-modal-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal-content confirm-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{confirmModal.title}</h3>
              <button className="btn-close flex items-center justify-center" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} aria-label="Close confirm modal">
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', color: '#8f95a3', fontSize: '0.9rem', lineHeight: '1.5' }}>
              {confirmModal.message}
            </div>
            <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button 
                className="btn-admin-nav" 
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button 
                className="trash-action-btn delete" 
                style={{ flex: 'none', padding: '0.5rem 1.25rem', fontSize: '0.85rem', width: 'auto' }} 
                onClick={() => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }))
                  confirmModal.onConfirm()
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
