'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface SharedFile {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: string
  uploadedAt: string
}

export default function PublicSharePage() {
  const { token } = useParams()
  const [file, setFile] = useState<SharedFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSharedMetadata() {
      if (!token) return
      try {
        const res = await fetch(`/api/share/${token}`)
        if (!res.ok) {
          setError('This share link has expired or is invalid.')
          return
        }
        const data = await res.json()
        setFile(data)
      } catch {
        setError('Connection error loading shared file.')
      } finally {
        setLoading(false)
      }
    }
    fetchSharedMetadata()
  }, [token])

  const formatSize = (bytesStr: string) => {
    const bytes = parseInt(bytesStr, 10)
    if (isNaN(bytes)) return '0 Bytes'
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card shimmer-loader" style={{ height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        </div>
      </div>
    )
  }

  if (error || !file) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="brand-logo" style={{ marginBottom: '1.5rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Link Expired</h1>
          <p style={{ color: '#8c9099', fontSize: '0.875rem', marginBottom: 0 }}>
            {error || 'This temporary share link is no longer valid.'}
          </p>
        </div>
      </div>
    )
  }

  const isImage = file.mimeType.startsWith('image/')
  const isVideo = file.mimeType.startsWith('video/')
  const previewUrl = `/api/share/${token}/view`
  const downloadUrl = `/api/share/${token}/download`

  return (
    <div className="auth-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="auth-card" style={{ maxWidth: '640px', padding: '2.5rem' }}>
        <div className="auth-brand" style={{ marginBottom: '1.5rem' }}>
          <div className="brand-logo">🛡️</div>
          <h1 style={{ fontSize: '1.25rem', marginTop: '0.5rem' }}>Shared Secure Vault File</h1>
          <p style={{ color: '#8c9099', fontSize: '0.8125rem' }}>Temporary Access (expires after 15 minutes)</p>
        </div>

        {/* Media Preview Container */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          maxHeight: '400px'
        }}>
          {isImage && (
            <img 
              src={previewUrl} 
              alt={file.originalName} 
              style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
            />
          )}
          {isVideo && (
            <video 
              controls 
              src={previewUrl} 
              style={{ width: '100%', maxHeight: '400px' }}
              preload="metadata"
            />
          )}
          {!isImage && !isVideo && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <span style={{ fontSize: '3rem' }}>📄</span>
              <p style={{ margin: '0.5rem 0 0 0', color: '#c9ccd0', fontSize: '0.875rem' }}>
                Preview not available for this file type.
              </p>
            </div>
          )}
        </div>

        {/* File Metadata Info */}
        <div className="settings-card" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', gap: '0.75rem', marginBottom: '1.5rem', borderRadius: '8px' }}>
          <div className="settings-field" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span className="field-label" style={{ fontSize: '0.75rem' }}>File Name</span>
            <span className="field-value" style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }} title={file.originalName}>
              {file.originalName}
            </span>
          </div>
          <div className="settings-field" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span className="field-label" style={{ fontSize: '0.75rem' }}>File Size</span>
            <span className="field-value" style={{ fontSize: '0.75rem' }}>{formatSize(file.fileSize)}</span>
          </div>
          <div className="settings-field" style={{ paddingBottom: 0, borderBottom: 'none' }}>
            <span className="field-label" style={{ fontSize: '0.75rem' }}>Mime Type</span>
            <span className="field-value badge" style={{ fontSize: '0.6875rem', padding: '0.15rem 0.5rem' }}>{file.mimeType}</span>
          </div>
        </div>

        {/* Download Button */}
        <a 
          href={downloadUrl} 
          className="btn-submit" 
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            textDecoration: 'none', 
            gap: '0.5rem',
            textAlign: 'center'
          }}
        >
          <span>📥</span> Download Original File
        </a>
      </div>
    </div>
  )
}
