'use client'

import { useState, useEffect } from 'react'

interface BackupAdminData {
  id: string
  fileId: string
  backupProvider: string | null
  backupFileId: string | null
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  errorMessage: string | null
  attempts: number
  createdAt: string
  file: {
    id: string
    originalName: string
    fileSize: string
    mimeType: string
    user: {
      id: string
      email: string
    }
  } | null
}

function formatBytes(bytesStr: string) {
  const bytes = parseFloat(bytesStr)
  if (isNaN(bytes) || bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState<BackupAdminData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  async function fetchBackups() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', '10')
      if (statusFilter) {
        params.append('status', statusFilter)
      }
      
      const res = await fetch(`/api/admin/backups?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Admin privileges required.')
        } else {
          setError('Failed to fetch backup logs.')
        }
        return
      }
      const data = await res.json()
      setBackups(data.backups || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalCount(data.pagination?.totalCount || 0)
    } catch {
      setError('Connection error fetching backup tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  useEffect(() => {
    fetchBackups()
  }, [statusFilter, page])

  async function handleRetry(backupId: string) {
    try {
      const res = await fetch(`/api/admin/backups/${backupId}/retry`, {
        method: 'POST',
      })
      if (res.ok) {
        fetchBackups()
      } else {
        const data = await res.json()
        alert(data.message || 'Failed to trigger backup retry.')
      }
    } catch {
      alert('Network error while retrying backup.')
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h2>Backup logs</h2>
          <p className="subtitle">Monitor Telegram cold storage backups and manually retry failed jobs</p>
        </div>
      </div>

      <div className="admin-filters-bar">
        <select
          className="admin-select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="BOTH">Both (Success & Failed)</option>
        </select>
      </div>

      {error && (
        <div className="auth-alert error">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <p className="loading-text">Loading cold storage status...</p>
      ) : backups.length === 0 ? (
        <div className="gallery-placeholder">
          <p className="placeholder-icon">⊙</p>
          <h2>No Backup Records Found</h2>
          <p className="placeholder-description">There are no files queued or uploaded to Telegram cold storage yet.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>File / Size</th>
                  <th>Owner</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Details / Error</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td data-label="File / Size" style={{ fontWeight: '500', wordBreak: 'break-all' }}>
                      {backup.file ? (
                        <>
                          <div style={{ fontWeight: '600' }}>{backup.file.originalName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#8f95a3', marginTop: '0.25rem' }}>
                            {formatBytes(backup.file.fileSize)}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Orphaned File</span>
                      )}
                    </td>
                    <td data-label="Owner">{backup.file?.user?.email || 'N/A'}</td>
                    <td data-label="Provider">
                      <span className="provider-badge" style={{ margin: 0 }}>
                        {backup.backupProvider || 'TELEGRAM'}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`admin-badge status-${backup.status.toLowerCase()}`}>
                        {backup.status}
                      </span>
                    </td>
                    <td data-label="Attempts">{backup.attempts} / 3</td>
                    <td data-label="Details / Error" style={{ maxWidth: '300px' }}>
                      {backup.status === 'SUCCESS' ? (
                        <span className="admin-badge status-success" style={{ margin: 0, textTransform: 'capitalize' }}>
                          success
                        </span>
                      ) : backup.status === 'FAILED' ? (
                        <span className="admin-badge status-failed" style={{ margin: 0, textTransform: 'capitalize' }}>
                          failed
                        </span>
                      ) : (
                        <span className="admin-badge status-pending" style={{ margin: 0, textTransform: 'capitalize' }}>
                          pending
                        </span>
                      )}
                    </td>
                    <td data-label="Created At">{new Date(backup.createdAt).toLocaleString()}</td>
                    <td data-label="Actions">
                      <div className="admin-actions">
                        <button
                          onClick={() => handleRetry(backup.id)}
                          disabled={backup.status === 'SUCCESS'}
                          className="btn-admin-action primary"
                          style={{ opacity: backup.status === 'SUCCESS' ? 0.5 : 1 }}
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-admin-nav"
              >
                ← Previous
              </button>
              <span style={{ fontSize: '0.875rem', color: 'var(--auth-text-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-admin-nav"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
