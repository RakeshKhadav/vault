'use client'

import { useState, useEffect } from 'react'

interface TrashedFile {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: string
  thumbnailFileId: string | null
  deletedAt: string
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

  const formatSize = (bytesStr: string) => {
    const bytes = parseInt(bytesStr, 10)
    if (isNaN(bytes)) return '0 B'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const isVideo = (mimeType: string) => mimeType.startsWith('video/')

  return (
    <div className="page-container">
      <div className="trash-header">
        <p className="trash-warning">
          ⚠️ Trashed items are preserved on storage nodes. Delete them permanently to free up account space.
        </p>
      </div>

      {isLoading ? (
        <div className="gallery-grid">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="media-card skeleton">
              <div className="skeleton-thumb" />
              <div className="skeleton-meta" />
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="gallery-placeholder">
          <p className="placeholder-icon">🗑️</p>
          <h2>Trash is empty</h2>
          <p className="placeholder-description">Files you delete will appear here for safe recovery.</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {files.map((file) => (
            <div key={file.id} className="media-card trash-card">
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
      )}
    </div>
  )
}
