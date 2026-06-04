'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatBytes as formatSize } from '@/lib/utils/format'
import { useModal } from '@/components/ModalProvider'
import {
  Trash,
  Trash2,
  RotateCcw,
  X,
  CheckSquare,
  Check,
  Film,
  Image as ImageIcon,
  Play,
  FolderOpen
} from 'lucide-react'

interface TrashedFile {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: string
  thumbnailFileId: string | null
  deletedAt: string
  thumbnailUrl?: string | null
}

export default function TrashPage() {
  const router = useRouter()
  const { alert } = useModal()
  const [files, setFiles] = useState<TrashedFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Pagination State
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Selection Mode State
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkRestoring, setIsBulkRestoring] = useState(false)
  const lastSelectedIndex = useRef<number | null>(null)

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

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(files.map((f) => f.id)))
  }, [files])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
    lastSelectedIndex.current = null
  }, [])

  const fetchTrash = useCallback(async (isFirstLoad = true, currentCursor: string | null = null) => {
    if (isFirstLoad) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }
    try {
      const params = new URLSearchParams()
      params.append('limit', '24')
      if (currentCursor) {
        params.append('cursor', currentCursor)
      }
      const res = await fetch(`/api/trash?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch trash')
      const data = await res.json()
      if (isFirstLoad) {
        setFiles(data.files)
      } else {
        setFiles((prev) => [...prev, ...data.files])
      }
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    } catch (err) {
      console.error('Error fetching trash:', err)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchTrash(true, null)
    setSelectedIds(new Set())
    lastSelectedIndex.current = null
  }, [fetchTrash])

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && cursor) {
        fetchTrash(false, cursor)
      }
    })
    if (node) observerRef.current.observe(node)
  }, [isLoading, isLoadingMore, hasMore, cursor, fetchTrash])

  const handleRestore = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/trash/${id}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to restore file')
      setFiles((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      console.error('Restore error:', err)
      await alert('Failed to restore file.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeleteForever = (id: string) => {
    openConfirmModal(
      'Delete File Permanently',
      'Are you sure you want to permanently delete this file? This action cannot be undone.',
      'Delete Forever',
      async () => {
        setProcessingId(id)
        try {
          const res = await fetch(`/api/trash/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to permanently delete file')
          setFiles((prev) => prev.filter((f) => f.id !== id))
        } catch (err) {
          console.error('Permanent deletion error:', err)
          await alert('Failed to permanently delete file.')
        } finally {
          setProcessingId(null)
        }
      }
    )
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    openConfirmModal(
      'Delete Selected Files Permanently',
      `Are you sure you want to permanently delete the ${selectedIds.size} selected files? This action cannot be undone.`,
      'Delete Forever',
      async () => {
        setIsBulkDeleting(true)
        try {
          const res = await fetch('/api/trash', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileIds: Array.from(selectedIds) }),
          })
          if (!res.ok) throw new Error('Failed to delete selected files')
          setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)))
          exitSelectMode()
        } catch (err) {
          console.error('Bulk permanent delete failed:', err)
          await alert('Failed to delete selected files.')
        } finally {
          setIsBulkDeleting(false)
        }
      }
    )
  }

  const handleBulkRestore = async () => {
    if (selectedIds.size === 0) return
    setIsBulkRestoring(true)
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error('Failed to restore selected files')
      setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)))
      exitSelectMode()
    } catch (err) {
      console.error('Bulk restore failed:', err)
      await alert('Failed to restore selected files.')
    } finally {
      setIsBulkRestoring(false)
    }
  }

  const isVideo = (mimeType: string) => mimeType.startsWith('video/')

  return (
    <div className="page-container">
      <div className="trash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', margin: '0 0 0.5rem 0' }}>Trash</h1>
          <p className="trash-warning" style={{ margin: 0 }}>
            Archived items here are preserved temporarily on storage nodes. Delete permanently to clear physical sectors.
          </p>
        </div>
        <button
          className={`select-mode-btn ${isSelectMode ? 'active' : ''}`}
          onClick={() => isSelectMode ? exitSelectMode() : setIsSelectMode(true)}
          disabled={files.length === 0}
        >
          {isSelectMode ? (
            <span className="flex items-center gap-1.5"><X size={14} /> Cancel</span>
          ) : (
            <span className="flex items-center gap-1.5"><CheckSquare size={14} /> Select</span>
          )}
        </button>
      </div>

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
              className="bulk-restore-btn"
              disabled={selectedIds.size === 0 || isBulkRestoring}
              onClick={handleBulkRestore}
            >
              {isBulkRestoring ? 'Restoring...' : (
                <span className="flex items-center gap-1.5"><RotateCcw size={14} /> Restore Selected</span>
              )}
            </button>
            <button 
              className="bulk-delete-btn"
              disabled={selectedIds.size === 0 || isBulkDeleting}
              onClick={handleBulkDelete}
            >
              {isBulkDeleting ? 'Deleting...' : (
                <span className="flex items-center gap-1.5"><Trash2 size={14} /> Delete Forever</span>
              )}
            </button>
          </div>
        </div>
      )}

      {isLoading && files.length === 0 ? (
        <div className="gallery-grid">
          {Array.from({ length: 6 }).map((_, idx) => {
            const aspectRatios = ['1/1', '16/9', '4/3', '3/2', '4/5', '1/1']
            const aspect = aspectRatios[idx % aspectRatios.length]
            const isVideo = idx % 3 === 0
            return (
              <div key={idx} className="media-card skeleton">
                <div className="skeleton-thumb" style={{ aspectRatio: aspect }}>
                  {isVideo && (
                    <div className="skeleton-video-play flex items-center justify-center">
                      <Play size={18} className="text-white opacity-60 fill-current" />
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
          <Trash size={48} className="text-zinc-500 mb-4 opacity-50 shrink-0" />
          <h2>Trash is empty.</h2>
          <p className="placeholder-description">Deleted files reside here temporarily for safe recovery.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-submit empty-state-btn"
            style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}
          >
            <FolderOpen size={16} /> Go to Gallery
          </button>
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
                className={`media-card trash-card ${isSelectMode && selectedIds.has(file.id) ? 'selected' : ''}`}
                onClick={(e) => isSelectMode ? toggleFileSelection(file.id, e) : undefined}
              >
                <div className="media-preview-wrapper" style={{ position: 'relative' }}>
                  {isSelectMode && (
                    <button
                      className={`card-select-checkbox flex items-center justify-center ${selectedIds.has(file.id) ? 'checked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFileSelection(file.id, e)
                      }}
                      aria-label={selectedIds.has(file.id) ? 'Deselect' : 'Select'}
                    >
                      {selectedIds.has(file.id) ? <Check size={12} strokeWidth={3} /> : ''}
                    </button>
                  )}
                  {file.thumbnailUrl ? (
                    <img
                      src={file.thumbnailUrl}
                      alt={file.originalName}
                      loading="lazy"
                      className="media-thumbnail"
                    />
                  ) : (
                    <div className="media-icon-placeholder flex items-center justify-center">
                      {isVideo(file.mimeType) ? (
                        <Film size={36} className="text-zinc-500 opacity-60" />
                      ) : (
                        <ImageIcon size={36} className="text-zinc-500 opacity-60" />
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
                </div>
                
                <div className="media-info">
                  <span className="media-title" title={file.originalName}>
                    {file.originalName}
                  </span>
                  <span className="media-size">
                    {formatSize(file.fileSize)} • Trashed on {new Date(file.deletedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="trash-actions">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestore(file.id); }}
                    disabled={processingId === file.id || isSelectMode}
                    className="trash-action-btn restore"
                  >
                    Restore
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteForever(file.id); }}
                    disabled={processingId === file.id || isSelectMode}
                    className="trash-action-btn delete"
                  >
                    Delete Forever
                  </button>
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
                    <div className="skeleton-video-play flex items-center justify-center">
                      <Play size={18} className="text-white opacity-60 fill-current" />
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
