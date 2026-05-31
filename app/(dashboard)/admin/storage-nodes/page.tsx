'use client'

import { useState, useEffect } from 'react'

interface StorageNode {
  id: string
  name: string
  provider: 'MEGA' | 'PCLOUD'
  totalSpaceMb: string
  usedSpaceMb: string
  isActive: boolean
  lastSyncAt: string | null
}

export default function AdminStorageNodesPage() {
  const [nodes, setNodes] = useState<StorageNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [nodeName, setNodeName] = useState('')
  const [provider, setProvider] = useState<'MEGA' | 'PCLOUD'>('MEGA')
  const [megaEmail, setMegaEmail] = useState('')
  const [megaPassword, setMegaPassword] = useState('')
  const [pcloudToken, setPcloudToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function fetchNodes() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/storage-nodes')
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Admin role required.')
        } else {
          setError('Failed to fetch storage nodes.')
        }
        return
      }
      const data = await res.json()
      setNodes(data.nodes || [])
    } catch {
      setError('Connection error fetching storage nodes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNodes()
  }, [])

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/admin/storage-nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })
      if (res.ok) {
        setNodes(nodes.map(n => n.id === id ? { ...n, isActive: !currentStatus } : n))
      }
    } catch {
      alert('Failed to update status')
    }
  }

  async function handleTestConnection(id: string) {
    try {
      const res = await fetch(`/api/admin/storage-nodes/${id}/test`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        alert('Connection test successful!')
        fetchNodes() // Refresh to get updated stats
      } else {
        alert(`Connection test failed: ${data.message || 'Check credentials'}`)
      }
    } catch {
      alert('Test request failed')
    }
  }

  async function handleDeleteNode(id: string) {
    if (!confirm('Are you sure you want to remove this storage node?')) return

    try {
      const res = await fetch(`/api/admin/storage-nodes/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setNodes(nodes.filter(n => n.id !== id))
      } else {
        const data = await res.json()
        alert(data.message || 'Failed to delete storage node.')
      }
    } catch {
      alert('Delete request failed')
    }
  }

  async function handleSubmitNode(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const credentials = provider === 'MEGA' 
      ? { email: megaEmail, password: megaPassword }
      : { token: pcloudToken }

    try {
      const res = await fetch('/api/admin/storage-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nodeName,
          provider,
          credentials,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.message || 'Failed to add storage node. Make sure credentials are valid.')
        return
      }

      setIsModalOpen(false)
      // Reset form
      setNodeName('')
      setMegaEmail('')
      setMegaPassword('')
      setPcloudToken('')
      
      fetchNodes() // Refresh nodes list
    } catch {
      alert('Failed to send request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h2>Storage Nodes</h2>
          <p className="subtitle">Manage external storage accounts and monitor allocations</p>
        </div>
        <button className="btn-add-node" onClick={() => setIsModalOpen(true)}>
          Add Storage Node
        </button>
      </div>

      {error && (
        <div className="auth-alert error">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <p className="loading-text">Loading storage nodes...</p>
      ) : nodes.length === 0 ? (
        <div className="gallery-placeholder">
          <p className="placeholder-icon">⊙</p>
          <h2>No Storage Nodes Connected</h2>
          <p className="placeholder-description">Add a MEGA or pCloud account as a storage node to start uploading files.</p>
        </div>
      ) : (
        <div className="nodes-grid">
          {nodes.map((node) => {
            const total = Number(node.totalSpaceMb)
            const used = Number(node.usedSpaceMb)
            const percentage = total > 0 ? Math.round((used / total) * 100) : 0
            
            return (
              <div key={node.id} className="node-card">
                <div className="node-card-header">
                  <div className="node-title-group">
                    <span className="provider-badge">{node.provider}</span>
                    <h3>{node.name}</h3>
                  </div>
                  <div className="node-status-group">
                    <button 
                      onClick={() => handleToggleActive(node.id, node.isActive)}
                      className={`status-indicator ${node.isActive ? 'active' : 'inactive'}`}
                      title={node.isActive ? 'Click to disable' : 'Click to enable'}
                    >
                      {node.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>

                <div className="node-card-body">
                  <div className="storage-meter-container">
                    <div className="storage-meter-labels">
                      <span>{used} MB of {total} MB used</span>
                      <span>{percentage}%</span>
                    </div>
                    <div className="storage-progress-bar">
                      <div className="storage-progress" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                  {node.lastSyncAt && (
                    <span className="sync-time">Last synced: {new Date(node.lastSyncAt).toLocaleString()}</span>
                  )}
                </div>

                <div className="node-card-actions">
                  <button onClick={() => handleTestConnection(node.id)} className="btn-action test">
                    Test Connection
                  </button>
                  <button onClick={() => handleDeleteNode(node.id)} className="btn-action delete">
                    Delete Node
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Add Node */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Connect Storage Node</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitNode} className="modal-form">
              <div className="form-group">
                <label htmlFor="friendlyNodeName">Friendly Name</label>
                <input
                  id="friendlyNodeName"
                  type="text"
                  placeholder="e.g. Mega Backup Account"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Storage Provider</label>
                <div className="provider-tabs">
                  <button 
                    type="button" 
                    className={`provider-tab ${provider === 'MEGA' ? 'active' : ''}`}
                    onClick={() => setProvider('MEGA')}
                  >
                    MEGA
                  </button>
                  <button 
                    type="button" 
                    className={`provider-tab ${provider === 'PCLOUD' ? 'active' : ''}`}
                    onClick={() => setProvider('PCLOUD')}
                  >
                    pCloud
                  </button>
                </div>
              </div>

              {provider === 'MEGA' ? (
                <>
                  <div className="form-group">
                    <label htmlFor="megaEmail">MEGA Email Address</label>
                    <input
                      id="megaEmail"
                      type="email"
                      placeholder="account@mega.nz"
                      value={megaEmail}
                      onChange={(e) => setMegaEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="megaPassword">MEGA Password</label>
                    <input
                      id="megaPassword"
                      type="password"
                      placeholder="••••••••"
                      value={megaPassword}
                      onChange={(e) => setMegaPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label htmlFor="pcloudToken">pCloud OAuth2 Token</label>
                  <input
                    id="pcloudToken"
                    type="password"
                    placeholder="Enter OAuth2 access token"
                    value={pcloudToken}
                    onChange={(e) => setPcloudToken(e.target.value)}
                    required
                  />
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Testing & Saving...' : 'Save Storage Node'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
