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

  async function fetchBackups() {
    setLoading(true)
    setError(null)
    try {
      const url = statusFilter 
        ? `/api/admin/backups?status=${statusFilter}`
        : '/api/admin/backups'
      
      const res = await fetch(url)
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
    } catch {
      setError('Connection error fetching backup tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBackups()
  }, [statusFilter])

  async function handleRetry(backupId: string) {
    try {
      const res = await fetch(`/api/admin/backups/${backupId}/retry`, {
        method: 'POST',
      })
      if (res.ok) {
        // Success: update item status locally to pending and attempts to 0
        setBackups(prevBackups =>
          prevBackups.map(b =>
            b.id === backupId
              ? { ...b, status: 'PENDING', attempts: 0, errorMessage: null }
              : b
          )
        )
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
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
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
                  <td style={{ fontWeight: '500', wordBreak: 'break-all' }}>
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
                  <td>{backup.file?.user?.email || 'N/A'}</td>
                  <td>
                    <span className="provider-badge" style={{ margin: 0 }}>
                      {backup.backupProvider || 'TELEGRAM'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge status-${backup.status.toLowerCase()}`}>
                      {backup.status}
                    </span>
                  </td>
                  <td>{backup.attempts} / 3</td>
                  <td style={{ maxWidth: '300px' }}>
                    {backup.errorMessage ? (
                      <div className="admin-error-box">{backup.errorMessage}</div>
                    ) : backup.backupFileId ? (
                      <code style={{ fontSize: '0.75rem', color: '#10b981', wordBreak: 'break-all' }}>
                        ID: {backup.backupFileId}
                      </code>
                    ) : (
                      <span style={{ color: '#8f95a3', fontSize: '0.8rem', fontStyle: 'italic' }}>—</span>
                    )}
                  </td>
                  <td>{new Date(backup.createdAt).toLocaleString()}</td>
                  <td>
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
      )}
    </div>
  )
}
