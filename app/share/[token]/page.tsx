'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatBytes as formatSize } from '@/lib/utils/format'
import { FileWarning, ShieldCheck, FileText, Download } from 'lucide-react'

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



  if (loading) {
    return (
      <div className="share-container">
        <div className="share-card loading-card shimmer-loader">
        </div>
      </div>
    )
  }

  if (error || !file) {
    return (
      <div className="share-container">
        <div className="share-card flex flex-col items-center" style={{ textAlign: 'center' }}>
          <div className="brand-logo" style={{ marginBottom: '1.5rem' }}>
            <FileWarning size={32} className="text-red-500 mx-auto" />
          </div>
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
    <div className="share-container">
      <div className="share-card">
        <div className="auth-brand" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div className="brand-logo flex justify-center mb-2">
            <ShieldCheck size={32} className="text-[var(--auth-accent)]" />
          </div>
          <h1 style={{ fontSize: '1.25rem', marginTop: '0.5rem' }}>Shared Secure Vault File</h1>
          <p style={{ color: '#8c9099', fontSize: '0.8125rem' }}>Temporary Access (expires after 15 minutes)</p>
        </div>

        {/* Media Preview Container */}
        <div className="share-media-container">
          {isImage && (
            <img 
              src={previewUrl} 
              alt={file.originalName} 
              className="share-media-preview-img"
            />
          )}
          {isVideo && (
            <video 
              controls 
              src={previewUrl} 
              className="share-media-preview-video"
              preload="metadata"
            />
          )}
          {!isImage && !isVideo && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <FileText size={48} className="text-zinc-500 mx-auto mb-2" />
              <p style={{ margin: '0.5rem 0 0 0', color: '#c9ccd0', fontSize: '0.875rem' }}>
                Preview not available for this file type.
              </p>
            </div>
          )}
        </div>

        {/* File Metadata Info */}
        <div className="share-metadata-card">
          <div className="share-metadata-field">
            <span className="field-label" style={{ fontSize: '0.75rem' }}>File Name</span>
            <div className="share-metadata-value-wrapper">
              <span className="share-metadata-value-ellipsis" title={file.originalName}>
                {file.originalName}
              </span>
            </div>
          </div>
          <div className="share-metadata-field">
            <span className="field-label" style={{ fontSize: '0.75rem' }}>File Size</span>
            <div className="share-metadata-value-wrapper">
              <span className="share-metadata-value-ellipsis">{formatSize(file.fileSize)}</span>
            </div>
          </div>
          <div className="share-metadata-field">
            <span className="field-label" style={{ fontSize: '0.75rem' }}>Mime Type</span>
            <div className="share-metadata-value-wrapper">
              <span className="field-value badge" style={{ fontSize: '0.6875rem', padding: '0.15rem 0.5rem', margin: 0 }}>{file.mimeType}</span>
            </div>
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
          <Download size={16} /> Download Original File
        </a>
      </div>
    </div>
  )
}
