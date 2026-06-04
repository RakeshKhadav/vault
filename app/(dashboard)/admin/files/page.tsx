'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatBytes } from '@/lib/utils/format'
import { AlertCircle, FolderSearch, ChevronLeft, ChevronRight } from 'lucide-react'
import { useModal } from '@/components/ModalProvider'

interface FileAdminData {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: string
  uploadedAt: string
  user: {
    id: string
    email: string
  }
}


export default function AdminFilesPage() {
  const { alert, confirm } = useModal()
  const [files, setFiles] = useState<FileAdminData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Search & Filter State
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  
  // Pagination State
  const [currentCursor, setCurrentCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorStack, setCursorStack] = useState<string[]>([])

  const fetchFiles = useCallback(async (cursor: string | null = null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', '25')
      if (search) params.set('search', search)
      if (type) params.set('type', type)
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/admin/files?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Admin privileges required.')
        } else {
          setError('Failed to fetch user files.')
        }
        return
      }
      const data = await res.json()
      setFiles(data.files || [])
      setNextCursor(data.nextCursor || null)
    } catch {
      setError('Connection error fetching system files.')
    } finally {
      setLoading(false)
    }
  }, [search, type])

  // Trigger search on mount and filter changes
  useEffect(() => {
    // Reset pagination when filter/search changes
    setCurrentCursor(null)
    setNextCursor(null)
    setCursorStack([])
    fetchFiles(null)
  }, [search, type, fetchFiles])

  function handleNextPage() {
    if (nextCursor) {
      setCursorStack((prev) => [...prev, currentCursor || ''])
      setCurrentCursor(nextCursor)
      fetchFiles(nextCursor)
    }
  }

  function handlePrevPage() {
    if (cursorStack.length > 0) {
      const newStack = [...cursorStack]
      const prevCursor = newStack.pop() || null
      setCursorStack(newStack)
      setCurrentCursor(prevCursor)
      fetchFiles(prevCursor)
    }
  }

  async function handleDeleteFile(fileId: string, name: string) {
    const isConfirmed = await confirm(
      `Are you sure you want to permanently delete "${name}"? This action cannot be undone and will purge the file from all storage nodes.`,
      {
        title: 'Purge File',
        confirmLabel: 'Purge',
        cancelLabel: 'Keep File',
      }
    )
    if (!isConfirmed) {
      return
    }

    try {
      const res = await fetch(`/api/admin/files/${fileId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setFiles(files.filter(f => f.id !== fileId))
      } else {
        const data = await res.json()
        await alert(data.message || 'Failed to delete file.')
      }
    } catch {
      await alert('Network error while deleting file.')
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h2>System Files</h2>
          <p className="subtitle">Audit, download, or moderate/delete files uploaded across all user libraries</p>
        </div>
      </div>

      <div className="admin-filters-bar">
        <input
          type="text"
          placeholder="Search by file name..."
          className="admin-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-select-filter"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All File Types</option>
          <option value="image">Images Only</option>
          <option value="video">Videos Only</option>
        </select>
      </div>

      {error && (
        <div className="auth-alert error flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="loading-text">Scanning storage nodes...</p>
      ) : files.length === 0 ? (
        <div className="gallery-placeholder">
          <FolderSearch size={48} className="text-zinc-500 mb-4 opacity-50 shrink-0" />
          <h2>No Files Found</h2>
          <p className="placeholder-description">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Owner</th>
                  <th>MIME Type</th>
                  <th>Size</th>
                  <th>Uploaded At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td data-label="File Name" style={{ fontWeight: '500', wordBreak: 'break-all' }}>{file.originalName}</td>
                    <td data-label="Owner">{file.user?.email || 'Unknown User'}</td>
                    <td data-label="MIME Type">{file.mimeType}</td>
                    <td data-label="Size">{formatBytes(file.fileSize)}</td>
                    <td data-label="Uploaded At">{new Date(file.uploadedAt).toLocaleString()}</td>
                    <td data-label="Actions">
                      <div className="admin-actions">
                        <a
                          href={`/api/admin/files/${file.id}/download`}
                          download
                          className="btn-admin-action primary"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => handleDeleteFile(file.id, file.originalName)}
                          className="btn-admin-action danger"
                        >
                          Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination flex items-center gap-3">
            <button
              onClick={handlePrevPage}
              disabled={cursorStack.length === 0}
              className="btn-admin-nav flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: '0.875rem', color: '#8f95a3' }}>
              Page {cursorStack.length + 1}
            </span>
            <button
              onClick={handleNextPage}
              disabled={!nextCursor}
              className="btn-admin-nav flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
