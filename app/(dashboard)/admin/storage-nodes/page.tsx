'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Database, X } from 'lucide-react'
import { useModal } from '@/components/ModalProvider'

interface StorageNode {
  id: string
  name: string
  provider: 'B2'
  totalSpaceMb: string
  usedSpaceMb: string
  isActive: boolean
  lastSyncAt: string | null
}

export default function AdminStorageNodesPage() {
  const { alert, confirm } = useModal()
  const [nodes, setNodes] = useState<StorageNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [nodeName, setNodeName] = useState('')
  const [b2BucketName, setB2BucketName] = useState('')
  const [b2Endpoint, setB2Endpoint] = useState('')
  const [b2Region, setB2Region] = useState('')
  const [b2KeyId, setB2KeyId] = useState('')
  const [b2ApplicationKey, setB2ApplicationKey] = useState('')
  const [b2BucketLimitGb, setB2BucketLimitGb] = useState('50')
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
      await alert('Failed to update status')
    }
  }

  async function handleTestConnection(id: string) {
    try {
      const res = await fetch(`/api/admin/storage-nodes/${id}/test`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        await alert('Connection test successful!', { title: 'Success' })
        fetchNodes() // Refresh to get updated stats
      } else {
        await alert(`Connection test failed: ${data.message || 'Check credentials'}`)
      }
    } catch {
      await alert('Test request failed')
    }
  }

  async function handleDeleteNode(id: string) {
    const isConfirmed = await confirm('Are you sure you want to remove this storage node?', {
      title: 'Remove Storage Node',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
    })
    if (!isConfirmed) return

    try {
      const res = await fetch(`/api/admin/storage-nodes/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setNodes(nodes.filter(n => n.id !== id))
      } else {
        const data = await res.json()
        await alert(data.message || 'Failed to delete storage node.')
      }
    } catch {
      await alert('Delete request failed')
    }
  }

  async function handleSubmitNode(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const credentials = {
      bucketName: b2BucketName,
      endpoint: b2Endpoint,
      region: b2Region,
      keyID: b2KeyId,
      applicationKey: b2ApplicationKey,
      bucketLimitGb: Number(b2BucketLimitGb) || 50,
    }

    try {
      const res = await fetch('/api/admin/storage-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nodeName,
          provider: 'B2',
          credentials,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        await alert(data.message || 'Failed to add storage node. Make sure credentials are valid.')
        return
      }

      setIsModalOpen(false)
      // Reset form
      setNodeName('')
      setB2BucketName('')
      setB2Endpoint('')
      setB2Region('')
      setB2KeyId('')
      setB2ApplicationKey('')
      setB2BucketLimitGb('50')
      
      fetchNodes() // Refresh nodes list
    } catch {
      await alert('Failed to send request.')
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
        <div className="auth-alert error flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="loading-text">Loading storage nodes...</p>
      ) : nodes.length === 0 ? (
        <div className="gallery-placeholder">
          <Database size={48} className="text-zinc-500 mb-4 opacity-50 shrink-0" />
          <h2>No Storage Nodes Connected</h2>
          <p className="placeholder-description">Add a Backblaze B2 S3-Compatible bucket as a storage node to start uploading files.</p>
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
              <h3>Connect Backblaze B2 Storage Node</h3>
              <button className="btn-close flex items-center justify-center" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitNode} className="modal-form">
              <div className="form-group">
                <label htmlFor="friendlyNodeName">Friendly Name</label>
                <input
                  id="friendlyNodeName"
                  type="text"
                  placeholder="e.g. Backblaze B2 Primary"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="b2BucketName">Bucket Name</label>
                <input
                  id="b2BucketName"
                  type="text"
                  placeholder="e.g. vault-media-app"
                  value={b2BucketName}
                  onChange={(e) => setB2BucketName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="b2Endpoint">Endpoint (S3 Host)</label>
                <input
                  id="b2Endpoint"
                  type="text"
                  placeholder="e.g. s3.us-east-005.backblazeb2.com"
                  value={b2Endpoint}
                  onChange={(e) => setB2Endpoint(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="b2Region">Region</label>
                <input
                  id="b2Region"
                  type="text"
                  placeholder="e.g. us-east-005"
                  value={b2Region}
                  onChange={(e) => setB2Region(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="b2KeyId">Application Key ID (keyID)</label>
                <input
                  id="b2KeyId"
                  type="text"
                  placeholder="Enter Key ID"
                  value={b2KeyId}
                  onChange={(e) => setB2KeyId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="b2ApplicationKey">Application Key Secret</label>
                <input
                  id="b2ApplicationKey"
                  type="password"
                  placeholder="Enter Application Key Secret"
                  value={b2ApplicationKey}
                  onChange={(e) => setB2ApplicationKey(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="b2BucketLimitGb">Storage Limit (GB)</label>
                <input
                  id="b2BucketLimitGb"
                  type="number"
                  placeholder="e.g. 50"
                  min="1"
                  value={b2BucketLimitGb}
                  onChange={(e) => setB2BucketLimitGb(e.target.value)}
                  required
                />
              </div>

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
