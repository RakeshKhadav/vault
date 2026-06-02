'use client'

import { useState, useEffect } from 'react'
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

  const handleDeleteForever = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this file? This action cannot be undone.')) {
      return
    }

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



  const isVideo = (mimeType: string) => mimeType.startsWith('video/')

  return (
    <div className="page-container">
      <div className="trash-header">
        <p className="trash-warning">
          Archived items here are preserved temporarily on storage nodes. Delete permanently to clear physical sectors.
        </p>
      </div>

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
            <div key={file.id} className="media-card trash-card">
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
                  onClick={() => handleRestore(file.id)}
                  disabled={processingId === file.id}
                  className="trash-action-btn restore"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDeleteForever(file.id)}
                  disabled={processingId === file.id}
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
    </div>
  )
}
