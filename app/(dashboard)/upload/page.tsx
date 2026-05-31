'use client'

import { useState, useEffect } from 'react'

interface UploadFileState {
  id: string
  name: string
  size: number
  status: 'PENDING' | 'UPLOADING' | 'SUCCESS' | 'FAILED'
  error?: string
  progress: number
}

interface UploadJob {
  id: string
  fileName: string
  status: 'UPLOADING' | 'SUCCESS' | 'FAILED'
  errorMessage: string | null
  createdAt: string
}

export default function UploadPage() {
  const [queue, setQueue] = useState<UploadFileState[]>([])
  const [history, setHistory] = useState<UploadJob[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  async function fetchHistory() {
    try {
      const res = await fetch('/api/upload-jobs?limit=10')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.jobs || [])
      }
    } catch (err) {
      console.error('Failed to load upload history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  function handleFileSelection(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    addFilesToQueue(Array.from(e.target.files))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      addFilesToQueue(Array.from(e.dataTransfer.files))
    }
  }

  function addFilesToQueue(files: File[]) {
    const newItems = files.map((file) => {
      const id = `${file.name}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      
      // Perform upload immediately
      uploadFile(file, id)

      return {
        id,
        name: file.name,
        size: file.size,
        status: 'PENDING' as const,
        progress: 0,
      }
    })

    setQueue((prev) => [...newItems, ...prev])
  }

  async function uploadFile(file: File, queueId: string) {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === queueId ? { ...item, status: 'UPLOADING', progress: 20 } : item
      )
    )

    const formData = new FormData()
    formData.append('files', file)

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok && data.jobIds?.length > 0) {
        // Poll status of the specific job
        pollJobStatus(data.jobIds[0], queueId)
      } else {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === queueId
              ? { ...item, status: 'FAILED', progress: 100, error: data.message || 'Upload failed' }
              : item
          )
        )
      }
    } catch {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === queueId
            ? { ...item, status: 'FAILED', progress: 100, error: 'Network error occurred' }
            : item
        )
      )
    }
  }

  async function pollJobStatus(jobId: string, queueId: string) {
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      try {
        const res = await fetch(`/api/upload-jobs/${jobId}`)
        if (res.ok) {
          const data = await res.json()
          const status = data.job.status

          if (status === 'SUCCESS') {
            clearInterval(interval)
            setQueue((prev) =>
              prev.map((item) =>
                item.id === queueId ? { ...item, status: 'SUCCESS', progress: 100 } : item
              )
            )
            fetchHistory() // Refresh history logs
          } else if (status === 'FAILED') {
            clearInterval(interval)
            setQueue((prev) =>
              prev.map((item) =>
                item.id === queueId
                  ? { ...item, status: 'FAILED', progress: 100, error: data.job.errorMessage || 'Storage error' }
                  : item
              )
            )
            fetchHistory()
          } else {
            // Still uploading
            setQueue((prev) =>
              prev.map((item) => {
                if (item.id === queueId) {
                  const nextProgress = Math.min(item.progress + 15, 90)
                  return { ...item, progress: nextProgress }
                }
                return item
              })
            )
          }
        }
      } catch {
        // Silently continue polling or abort after too many failures
      }

      if (attempts > 30) {
        clearInterval(interval)
        setQueue((prev) =>
          prev.map((item) =>
            item.id === queueId ? { ...item, status: 'FAILED', progress: 100, error: 'Polling timeout' } : item
          )
        )
      }
    }, 1000)
  }

  return (
    <div className="upload-page">
      <div
        className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="placeholder-icon">📤</span>
        <h2>Drag and drop media here</h2>
        <p className="placeholder-description">
          Support for Photos (max 20MB) and Videos (max 2GB)
        </p>
        <label className="btn-select-files">
          Select Files
          <input
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelection}
          />
        </label>
      </div>

      {queue.length > 0 && (
        <div className="upload-section">
          <h3>Active Queue ({queue.filter(i => i.status === 'UPLOADING').length} uploading)</h3>
          <div className="queue-list">
            {queue.map((item) => (
              <div key={item.id} className="queue-item">
                <div className="queue-item-info">
                  <span className="file-name">{item.name}</span>
                  <span className="file-size">{(item.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div className="queue-progress-container">
                  <div className="queue-progress-bar">
                    <div
                      className={`queue-progress ${item.status.toLowerCase()}`}
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                  <span className={`status-text ${item.status.toLowerCase()}`}>
                    {item.status === 'FAILED' ? `Failed: ${item.error}` : item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="upload-section">
        <h3>Upload History</h3>
        {loadingHistory ? (
          <p className="loading-text">Loading history logs...</p>
        ) : history.length === 0 ? (
          <p className="loading-text">No files uploaded recently.</p>
        ) : (
          <div className="history-list">
            {history.map((job) => (
              <div key={job.id} className="history-item">
                <div className="history-info">
                  <span className="history-name">{job.fileName}</span>
                  <span className="history-date">
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className={`history-status ${job.status.toLowerCase()}`}>
                  {job.status === 'FAILED' ? `Failed: ${job.errorMessage}` : job.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
