'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface UserProfile {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
  createdAt: string
}

interface StorageStats {
  usedSpaceBytes: string
  limitBytes: string
  percentage: number
}

interface StorageNode {
  id: string
  name: string
  provider: 'MEGA' | 'PCLOUD'
  totalSpaceMb: string
  usedSpaceMb: string
  isActive: boolean
  lastSyncAt: string | null
}

interface MeData {
  user: UserProfile
  storage: StorageStats
  storageNodes: StorageNode[]
}

export default function SettingsPage() {
  const [data, setData] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) {
          if (res.status === 401) {
            setError('Unauthorized access. Please log in.')
          } else {
            setError('Failed to fetch settings metadata.')
          }
          return
        }
        const meData = await res.json()
        setData(meData)
      } catch {
        setError('Network error fetching settings metadata.')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const formatSize = (bytesStr: string) => {
    const bytes = parseInt(bytesStr, 10)
    if (isNaN(bytes)) return '0 Bytes'
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSyncTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never synced'
    return new Date(dateStr).toLocaleString()
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="settings-shell">
          <section className="settings-section">
            <div className="shimmer-loader" style={{ height: '24px', width: '200px', marginBottom: '8px', borderRadius: '4px' }}></div>
            <div className="shimmer-loader" style={{ height: '16px', width: '350px', marginBottom: '16px', borderRadius: '4px' }}></div>
            <div className="settings-card shimmer-loader" style={{ height: '120px', borderRadius: '12px' }}></div>
          </section>
          <section className="settings-section">
            <div className="shimmer-loader" style={{ height: '24px', width: '150px', marginBottom: '8px', borderRadius: '4px' }}></div>
            <div className="shimmer-loader" style={{ height: '16px', width: '300px', marginBottom: '16px', borderRadius: '4px' }}></div>
            <div className="settings-card shimmer-loader" style={{ height: '90px', borderRadius: '12px' }}></div>
          </section>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="page-container">
        <div className="auth-alert error">
          <span>⚠️</span> {error || 'Something went wrong.'}
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <Link href="/login" className="btn-admin-shortcut" style={{ display: 'inline-block' }}>
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  const joinedDate = new Date(data.user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="page-container">
      <div className="settings-shell">
        {/* Account Details Section */}
        <section className="settings-section">
          <h3>Account Information</h3>
          <p className="section-description">View and manage your login details and account credentials.</p>
          <div className="settings-card">
            <div className="settings-field">
              <span className="field-label">Email Address</span>
              <span className="field-value">{data.user.email}</span>
            </div>
            <div className="settings-field">
              <span className="field-label">Account Role</span>
              <span className={`field-value badge ${data.user.role === 'ADMIN' ? 'admin-role' : ''}`}>
                {data.user.role}
              </span>
            </div>
            <div className="settings-field">
              <span className="field-label">Member Since</span>
              <span className="field-value">{joinedDate}</span>
            </div>
          </div>
        </section>

        {/* User Storage Usage Quota */}
        <section className="settings-section">
          <h3>Storage Usage</h3>
          <p className="section-description">Your allocated vault storage quota across all files.</p>
          <div className="settings-card">
            <div className="storage-meter-container">
              <div className="storage-meter-labels">
                <span>{formatSize(data.storage.usedSpaceBytes)} of 20 GB used</span>
                <span>{data.storage.percentage}%</span>
              </div>
              <div className="storage-progress-bar">
                <div 
                  className="storage-progress" 
                  style={{ 
                    width: `${Math.min(data.storage.percentage, 100)}%`,
                    background: data.storage.percentage > 90 ? '#ef4444' : '#3b82f6' 
                  }}
                ></div>
              </div>
            </div>
          </div>
        </section>

        {/* Connected Storage Nodes Section */}
        <section className="settings-section">
          <h3>Connected Storage Nodes</h3>
          <p className="section-description">
            Current health status and allocations for external storage cloud nodes.
          </p>
          {data.storageNodes.length === 0 ? (
            <div className="settings-card" style={{ alignItems: 'center', textAlign: 'center', padding: '2rem 1.5rem' }}>
              <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗄️</span>
              <h4 style={{ color: '#ffffff', margin: '0 0 0.25rem 0' }}>No Nodes Configured</h4>
              <p style={{ color: '#8f95a3', margin: 0, fontSize: '0.875rem' }}>
                Storage nodes must be configured by an administrator to upload files.
              </p>
            </div>
          ) : (
            <div className="nodes-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {data.storageNodes.map((node) => {
                const total = Number(node.totalSpaceMb)
                const used = Number(node.usedSpaceMb)
                const percentage = total > 0 ? Math.round((used / total) * 100) : 0

                return (
                  <div key={node.id} className="node-card" style={{ gap: '1rem' }}>
                    <div className="node-card-header">
                      <div className="node-title-group">
                        <span className="provider-badge">{node.provider}</span>
                        <h3 style={{ fontSize: '1rem' }}>{node.name}</h3>
                      </div>
                      <span className={`status-indicator ${node.isActive ? 'active' : 'inactive'}`} style={{ cursor: 'default' }}>
                        {node.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="node-card-body" style={{ padding: 0 }}>
                      <div className="storage-meter-container" style={{ gap: '0.5rem' }}>
                        <div className="storage-meter-labels" style={{ fontSize: '0.75rem' }}>
                          <span>{used} MB of {total} MB</span>
                          <span>{percentage}%</span>
                        </div>
                        <div className="storage-progress-bar" style={{ height: '6px' }}>
                          <div className="storage-progress" style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                        </div>
                      </div>
                      <span className="sync-time" style={{ fontSize: '0.6875rem', marginTop: '0.5rem' }}>
                        Sync: {formatSyncTime(node.lastSyncAt)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Administrative Controls Section */}
        {data.user.role === 'ADMIN' && (
          <section className="settings-section admin-settings-banner">
            <h3>Administrative Controls</h3>
            <p className="section-description">
              Manage system-wide storage allocations, connect node provider credentials, and sync databases.
            </p>
            <div className="settings-card admin-shortcut-card">
              <div className="admin-shortcut-content">
                <span className="admin-icon">🛠️</span>
                <div>
                  <h4>Storage Nodes Manager</h4>
                  <p>Configure credentials, toggle nodes active status, or delete allocations.</p>
                </div>
              </div>
              <Link href="/admin/storage-nodes" className="btn-admin-shortcut">
                Manage Nodes
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
