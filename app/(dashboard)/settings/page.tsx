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
  
  // Theme Preference State
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'system' | 'dark' | 'light' | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    const handleGlobalThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent
      setTheme(customEvent.detail)
    }
    window.addEventListener('theme-changed', handleGlobalThemeChange)
    return () => window.removeEventListener('theme-changed', handleGlobalThemeChange)
  }, [])

  const handleThemeChange = (newTheme: 'system' | 'dark' | 'light') => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    const root = document.documentElement
    let resolvedTheme = newTheme
    if (newTheme === 'system') {
      resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.setAttribute('data-theme', resolvedTheme)
    } else {
      root.setAttribute('data-theme', newTheme)
    }
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: resolvedTheme }))
  }

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null)
  const [updatingPassword, setUpdatingPassword] = useState(false)

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

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdatingPassword(true)
    setPasswordStatus(null)

    try {
      // Send standard request (mocked endpoint or direct implementation)
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (res.ok) {
        setPasswordStatus('Password changed successfully.')
        setCurrentPassword('')
        setNewPassword('')
      } else {
        const errData = await res.json()
        setPasswordStatus(errData.message || 'Failed to update password.')
      }
    } catch {
      setPasswordStatus('Connection error updating password.')
    } finally {
      setUpdatingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="settings-shell">
          <section className="settings-section">
            <div className="shimmer-loader" style={{ height: '20px', width: '180px', marginBottom: '8px', borderRadius: '4px' }} />
            <div className="shimmer-loader" style={{ height: '14px', width: '320px', marginBottom: '16px', borderRadius: '4px' }} />
          </section>
          <section className="settings-section">
            <div className="shimmer-loader" style={{ height: '20px', width: '120px', marginBottom: '8px', borderRadius: '4px' }} />
            <div className="shimmer-loader" style={{ height: '14px', width: '280px', marginBottom: '16px', borderRadius: '4px' }} />
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
          <Link href="/login" className="btn-admin-nav" style={{ display: 'inline-block' }}>
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

  // Simple visual storage calculation
  const limitBytesVal = parseInt(data.storage.limitBytes, 10) || 21474836480 // 20GB fallback
  const remainingBytesVal = Math.max(0, limitBytesVal - (parseInt(data.storage.usedSpaceBytes, 10) || 0))

  return (
    <div className="page-container">
      <div className="settings-shell">
        {/* Account Details */}
        <section className="settings-section">
          <h3>Account</h3>
          <p className="section-description">Manage profile details and basic info.</p>
          <div className="settings-card">
            <div className="settings-field">
              <span className="field-label">Email Address</span>
              <span className="field-value">{data.user.email}</span>
            </div>
            <div className="settings-field">
              <span className="field-label">Account Privilege</span>
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

        {/* Storage details */}
        <section className="settings-section">
          <h3>Storage</h3>
          <p className="section-description">Physical memory capacity and current allocations.</p>
          <div className="settings-card">
            <div className="settings-field">
              <span className="field-label">Occupied</span>
              <span className="field-value">{formatSize(data.storage.usedSpaceBytes)}</span>
            </div>
            <div className="settings-field">
              <span className="field-label">Available Space</span>
              <span className="field-value">{formatSize(remainingBytesVal.toString())}</span>
            </div>
            <div className="storage-meter-container" style={{ width: '100%', marginTop: '0.75rem' }}>
              <div className="storage-progress-bar">
                <div 
                  className="storage-progress" 
                  style={{ 
                    width: `${Math.min(data.storage.percentage, 100)}%`,
                    background: data.storage.percentage > 90 ? '#ef4444' : 'var(--auth-accent)' 
                  }}
                />
              </div>
              <div className="storage-meter-labels" style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--auth-text-muted)' }}>
                <span>{data.storage.percentage}% in use</span>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance details */}
        <section className="settings-section">
          <h3>Appearance</h3>
          <p className="section-description">Customize the visual presentation of the workspace.</p>
          <div className="settings-card">
            <div className="settings-field">
              <span className="field-label">Interface Theme</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['system', 'dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    style={{
                      background: theme === t ? 'var(--auth-accent)' : 'var(--auth-surface)',
                      color: theme === t ? 'var(--auth-bg)' : 'var(--auth-text)',
                      border: '1px solid var(--auth-border)',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Security Details */}
        <section className="settings-section">
          <h3>Security</h3>
          <p className="section-description">Update passwords and inspect session security.</p>
          <div className="settings-card">
            <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--auth-text-muted)', textTransform: 'uppercase' }}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{
                    padding: '0.625rem',
                    background: 'var(--auth-surface)',
                    border: '1px solid var(--auth-border)',
                    borderRadius: '4px',
                    color: 'var(--auth-text)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--auth-text-muted)', textTransform: 'uppercase' }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    padding: '0.625rem',
                    background: 'var(--auth-surface)',
                    border: '1px solid var(--auth-border)',
                    borderRadius: '4px',
                    color: 'var(--auth-text)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={updatingPassword}
                style={{
                  background: 'var(--auth-text)',
                  color: 'var(--auth-bg)',
                  border: 'none',
                  padding: '0.625rem',
                  borderRadius: '4px',
                  fontSize: '0.8125rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                {updatingPassword ? 'Saving...' : 'Update Password'}
              </button>
              {passwordStatus && (
                <p style={{ fontSize: '0.75rem', color: 'var(--auth-accent)', margin: 0 }}>{passwordStatus}</p>
              )}
            </form>
            <div className="settings-field" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--auth-border)' }}>
              <span className="field-label">Active Sessions</span>
              <span className="field-value" style={{ color: 'var(--auth-accent-alt)' }}>1 active session</span>
            </div>
          </div>
        </section>

        {/* System Management (Admins Only) */}
        {data.user.role === 'ADMIN' && (
          <section className="settings-section">
            <h3>System Management</h3>
            <p className="section-description">Advanced configurations and storage allocations for cloud storage nodes.</p>
            <div className="settings-card">
              <div className="settings-field">
                <span className="field-label">Connected Nodes</span>
                <span className="field-value">{data.storageNodes.length} Active</span>
              </div>
              {data.storageNodes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {data.storageNodes.map((node) => (
                    <div key={node.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--auth-text-muted)' }}>
                      <span>{node.name} ({node.provider})</span>
                      <span>Sync: {formatSyncTime(node.lastSyncAt)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '1.25rem' }}>
                <Link 
                  href="/admin/storage-nodes" 
                  className="btn-admin-nav" 
                  style={{ display: 'inline-block', fontSize: '0.75rem', textDecoration: 'none' }}
                >
                  Manage Storage Nodes
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
