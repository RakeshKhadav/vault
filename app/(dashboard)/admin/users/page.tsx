'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatBytes } from '@/lib/utils/format'

interface UserAdminData {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
  createdAt: string
  storageUsedBytes: string
  filesCount: number
}


export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserAdminData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Admin privileges required.')
        } else {
          setError('Failed to fetch system users.')
        }
        return
      }
      const data = await res.json()
      setUsers(data.users || [])
    } catch {
      setError('Connection error fetching users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h2>System Users</h2>
          <p className="subtitle">Manage user accounts, roles, and aggregate system storage allocations</p>
        </div>
      </div>

      {error && (
        <div className="auth-alert error">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <p className="loading-text">Loading user directories...</p>
      ) : users.length === 0 ? (
        <div className="gallery-placeholder">
          <p className="placeholder-icon">👥</p>
          <h2>No Users Found</h2>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email Address</th>
                <th>Role</th>
                <th>Registered At</th>
                <th>Total Files</th>
                <th>Storage Occupied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Email Address" style={{ fontWeight: '500' }}>{user.email}</td>
                  <td data-label="Role">
                    <span className={`admin-badge ${user.role === 'ADMIN' ? 'role-admin' : 'role-user'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td data-label="Registered At">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td data-label="Total Files">{user.filesCount}</td>
                  <td data-label="Storage Occupied">{formatBytes(user.storageUsedBytes)}</td>
                  <td data-label="Actions">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="btn-admin-nav"
                      style={{ display: 'inline-block', fontSize: '0.75rem', textDecoration: 'none' }}
                    >
                      View Gallery
                    </Link>
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
