'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { sharedUploadQueue } from '@/lib/shared-upload-queue'
import { useMediaViewer } from '@/lib/hooks/useMediaViewer'
import { useModal } from '@/components/ModalProvider'
import { MediaViewer } from '@/components/gallery/MediaViewer'
import { MediaGrid } from '@/components/gallery/MediaGrid'
import { GalleryToolbar } from '@/components/gallery/GalleryToolbar'
import { formatBytes as formatSize } from '@/lib/utils/format'
import { UploadCloud, X, CheckSquare, Download, Trash2, FolderOpen } from 'lucide-react'

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

function GalleryPageContent() {
  const { alert, confirm } = useModal()
  const [files, setFiles] = useState<MediaFile[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const typeFilter = (searchParams.get('type') || 'all') as 'all' | 'image' | 'video'
  const debouncedSearch = searchParams.get('search') || ''
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const datePreset = (searchParams.get('preset') || 'anytime') as 'anytime' | 'today' | 'week' | 'month' | 'year'

  const [searchQuery, setSearchQuery] = useState(debouncedSearch)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  useEffect(() => {
    setSearchQuery(debouncedSearch)
  }, [debouncedSearch])

  const updateFilters = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('cursor')

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all' || (key === 'preset' && value === 'anytime')) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDownloading, setIsBulkDownloading] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastSelectedIndex = useRef<number | null>(null)

  const applyDatePreset = (preset: 'anytime' | 'today' | 'week' | 'month' | 'year') => {
    const now = new Date()
    let start = ''
    let end = ''
    
    if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0]
      start = todayStr
      end = todayStr
    } else if (preset === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      start = oneWeekAgo.toISOString().split('T')[0]
      end = now.toISOString().split('T')[0]
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      start = firstDay.toISOString().split('T')[0]
      end = now.toISOString().split('T')[0]
    } else if (preset === 'year') {
      const firstDayOfYear = new Date(now.getFullYear(), 0, 1)
      start = firstDayOfYear.toISOString().split('T')[0]
      end = now.toISOString().split('T')[0]
    }

    updateFilters({
      preset: preset === 'anytime' ? null : preset,
      startDate: start || null,
      endDate: end || null
    })
  }

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
        if (next.has(fileId)) next.delete(fileId)
        else next.add(fileId)
      }
      return next
    })
    lastSelectedIndex.current = currentIndex
  }, [files])

  const selectAll = useCallback(() => setSelectedIds(new Set(files.map((f) => f.id))), [files])
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
      await alert('Failed to download selected files.')
    } finally {
      setIsBulkDownloading(false)
    }
  }, [selectedIds, files])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    const isConfirmed = await confirm(`Are you sure you want to move the ${selectedIds.size} selected files to trash?`, {
      title: 'Move Selected to Trash',
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Keep Files'
    })
    if (!isConfirmed) return
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
  }, [selectedIds, exitSelectMode, alert, confirm])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery !== debouncedSearch) updateFilters({ search: searchQuery })
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery, debouncedSearch, updateFilters])

  const fetchFiles = useCallback(async (isFirstLoad = true, currentCursor: string | null = null) => {
    if (isFirstLoad) setIsLoading(true)
    else setIsLoadingMore(true)
    try {
      const params = new URLSearchParams()
      params.append('limit', '24')
      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (currentCursor) params.append('cursor', currentCursor)
      const res = await fetch(`/api/files?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch files')
      const data = await res.json()
      if (isFirstLoad) setFiles(data.files)
      else setFiles((prev) => [...prev, ...data.files])
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    } catch (err) {
      console.error('Error loading gallery files:', err)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [typeFilter, debouncedSearch, startDate, endDate])

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

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && cursor) fetchFiles(false, cursor)
    })
    if (node) observerRef.current.observe(node)
  }, [isLoading, isLoadingMore, hasMore, cursor, fetchFiles])

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

  const toggleFavorite = async (fileId: string, index: number, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const file = files[index]
    if (!file) return
    const isCurrentlyFavorite = file.isFavorite
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
      setFiles((prev) => {
        const reverted = [...prev]
        reverted[index] = { ...file, isFavorite: isCurrentlyFavorite }
        return reverted
      })
    }
  }

  const handleDelete = async (fileId: string, index: number, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const isConfirmed = await confirm('Are you sure you want to move this file to trash?', {
      title: 'Move File to Trash',
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Keep File'
    })
    if (!isConfirmed) return
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete file')
      setFiles((prev) => prev.filter((_, i) => i !== index))
      viewer.setActiveMediaIndex(null)
    } catch (err) {
      await alert('Failed to delete file.')
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
      await alert('Failed to generate share link.')
    } finally {
      setIsSharing(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      sharedUploadQueue.addFiles(Array.from(e.dataTransfer.files))
      router.push('/upload')
    }
  }

  return (
    <div className="page-container" onDragOver={handleDragOver}>
      {isDraggingOver && (
        <div 
          className="gallery-drag-overlay"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => { e.preventDefault(); setIsDraggingOver(false); }}
          onDrop={handleDrop}
        >
          <div className="drag-overlay-content flex flex-col items-center">
            <UploadCloud size={48} className="text-blue-500 mb-4 animate-bounce shrink-0" />
            <h2>Drop files anywhere to start uploading</h2>
            <p>Your files will be automatically redirected and queued for upload</p>
          </div>
        </div>
      )}

      <GalleryToolbar
        searchPlaceholder="Search media..."
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={(type) => updateFilters({ type: type === 'all' ? null : type })}
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
              onClick={handleBulkDownload}
              disabled={selectedIds.size === 0 || isBulkDownloading}
            >
              {isBulkDownloading ? 'Downloading...' : (
                <span className="flex items-center gap-1.5"><Download size={14} /> Download Selected</span>
              )}
            </button>
            <button 
              className="bulk-delete-btn"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || isBulkDeleting}
            >
              {isBulkDeleting ? 'Deleting...' : (
                <span className="flex items-center gap-1.5"><Trash2 size={14} /> Delete Selected</span>
              )}
            </button>
          </div>
        </div>
      )}

      {files.length === 0 && !isLoading ? (
        <div className="gallery-placeholder">
          <FolderOpen size={48} className="text-zinc-500 mb-4 opacity-50 shrink-0" />
          <h2>The collection is quiet.</h2>
          <p className="placeholder-description">
            {searchQuery || typeFilter !== 'all'
              ? 'No matching memories found in the index.'
              : 'Begin preserving your stories. Drag files here or choose upload to start your archive.'}
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
    </div>
  )
}

export default function GalleryPage() {
  return (
    <Suspense fallback={<div className="page-container">Loading gallery...</div>}>
      <GalleryPageContent />
    </Suspense>
  )
}
