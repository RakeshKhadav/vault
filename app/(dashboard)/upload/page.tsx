'use client'

import { useState, useEffect, useRef } from 'react'
import { sharedUploadQueue } from '@/lib/shared-upload-queue'

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
  const activePollIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map())

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

    // Process files already in the shared queue
    const queuedFiles = sharedUploadQueue.getAndClear()
    if (queuedFiles.length > 0) {
      addFilesToQueue(queuedFiles)
    }

    // Subscribe to any new files added while this page is mounted
    const unsubscribe = sharedUploadQueue.subscribe(() => {
      const newFiles = sharedUploadQueue.getAndClear()
      if (newFiles.length > 0) {
        addFilesToQueue(newFiles)
      }
    })

    return () => {
      unsubscribe()
      activePollIntervals.current.forEach((intervalId) => clearInterval(intervalId))
      activePollIntervals.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        item.id === queueId ? { ...item, status: 'UPLOADING', progress: 0 } : item
      )
    )

    try {
      // 1. Get presigned upload URL
      const getUrlRes = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      })

      const urlData = await getUrlRes.json()

      if (!getUrlRes.ok) {
        throw new Error(urlData.message || 'Failed to get upload URL')
      }

      const { uploadUrl, providerFileId, storageNodeId, jobId } = urlData

      // 2. Perform direct upload to B2 via PUT
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl, true)
      xhr.setRequestHeader('Content-Type', file.type)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          const displayPercent = Math.min(percentComplete, 99)
          setQueue((prev) =>
            prev.map((item) =>
              item.id === queueId ? { ...item, progress: displayPercent } : item
            )
          )
        }
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // 3. Confirm upload on backend
          try {
            const confirmRes = await fetch('/api/files/upload/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jobId,
                providerFileId,
                storageNodeId,
                fileName: file.name,
                mimeType: file.type,
                fileSize: file.size,
              }),
            })

            const confirmData = await confirmRes.json()

            if (confirmRes.ok) {
              pollJobStatus(jobId, queueId)
            } else {
              throw new Error(confirmData.message || 'Failed to confirm upload')
            }
          } catch (confirmErr: any) {
            setQueue((prev) =>
              prev.map((item) =>
                item.id === queueId
                  ? { ...item, status: 'FAILED', progress: 100, error: confirmErr.message || 'Confirmation failed' }
                  : item
              )
            )
          }
        } else {
          setQueue((prev) =>
            prev.map((item) =>
              item.id === queueId
                ? { ...item, status: 'FAILED', progress: 100, error: `Upload error (${xhr.status})` }
                : item
            )
          )
        }
      }

      xhr.onerror = () => {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === queueId ? { ...item, status: 'FAILED', progress: 100, error: 'B2 connection failed' } : item
          )
        )
      }

      xhr.send(file)
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === queueId ? { ...item, status: 'FAILED', progress: 100, error: err.message || 'Upload failed' } : item
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
            activePollIntervals.current.delete(queueId)
            setQueue((prev) =>
              prev.map((item) =>
                item.id === queueId ? { ...item, status: 'SUCCESS', progress: 100 } : item
              )
            )
            fetchHistory() // Refresh history logs
          } else if (status === 'FAILED') {
            clearInterval(interval)
            activePollIntervals.current.delete(queueId)
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
        activePollIntervals.current.delete(queueId)
        setQueue((prev) =>
          prev.map((item) =>
            item.id === queueId ? { ...item, status: 'FAILED', progress: 100, error: 'Polling timeout' } : item
          )
        )
      }
    }, 1000)
    activePollIntervals.current.set(queueId, interval)
  }

  return (
    <div className="upload-page">
      <div
        className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="upload-dropzone-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 3L12 15M12 3L8 7M12 3L16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 17V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </span>
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
