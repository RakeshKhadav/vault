'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatBytes as formatSize } from '@/lib/utils/format'

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
  const [files, setFiles] = useState<TrashedFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

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

  const fetchTrash = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/trash')
      if (!res.ok) throw new Error('Failed to fetch trash')
      const data = await res.json()
      setFiles(data.files)
    } catch (err) {
      console.error('Error fetching trash:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTrash()
    setSelectedIds(new Set())
    lastSelectedIndex.current = null
  }, [])

  const handleRestore = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/trash/${id}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to restore file')
      setFiles((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      console.error('Restore error:', err)
      alert('Failed to restore file.')
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
          alert('Failed to permanently delete file.')
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
          alert('Failed to delete selected files.')
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
      alert('Failed to restore selected files.')
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
        {files.length > 0 && (
          <button
            className={`select-mode-btn ${isSelectMode ? 'active' : ''}`}
            onClick={() => isSelectMode ? exitSelectMode() : setIsSelectMode(true)}
          >
            {isSelectMode ? '✕ Cancel' : '☐ Select'}
          </button>
        )}
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
              {isBulkRestoring ? 'Restoring...' : '🔄 Restore Selected'}
            </button>
            <button 
              className="bulk-delete-btn"
              disabled={selectedIds.size === 0 || isBulkDeleting}
              onClick={handleBulkDelete}
            >
              {isBulkDeleting ? 'Deleting...' : '🗑️ Delete Forever'}
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
          <h2>Trash is empty.</h2>
          <p className="placeholder-description">Deleted files reside here temporarily for safe recovery.</p>
        </div>
      ) : (
        <div className={`gallery-grid-wrapper ${isLoading ? 'gallery-updating' : ''}`}>
          <div className="gallery-grid">
          {files.map((file) => (
            <div 
              key={file.id} 
              className={`media-card trash-card ${isSelectMode && selectedIds.has(file.id) ? 'selected' : ''}`}
              onClick={(e) => isSelectMode ? toggleFileSelection(file.id, e) : undefined}
            >
              <div className="media-preview-wrapper" style={{ position: 'relative' }}>
                {isSelectMode && (
                  <button
                    className={`card-select-checkbox ${selectedIds.has(file.id) ? 'checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFileSelection(file.id, e)
                    }}
                    aria-label={selectedIds.has(file.id) ? 'Deselect' : 'Select'}
                  >
                    {selectedIds.has(file.id) ? '✓' : ''}
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
                  <div className="media-icon-placeholder">
                    {isVideo(file.mimeType) ? '🎬' : '📷'}
                  </div>
                )}
                {isVideo(file.mimeType) && (
                  <div className="video-badge">
                    <span className="play-icon">▶</span>
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
          ))}
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{confirmModal.title}</h3>
              <button className="btn-close" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>✕</button>
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
