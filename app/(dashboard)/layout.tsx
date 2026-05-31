'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { name: 'Gallery', path: '/dashboard', icon: '🖼️' },
    { name: 'Upload', path: '/upload', icon: '📤' },
    { name: 'Favorites', path: '/favorites', icon: '⭐' },
    { name: 'Trash', path: '/trash', icon: '🗑️' },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
  ]

  async function handleLogout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (res.ok) {
        router.push('/login')
        router.refresh()
      }
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  return (
    <div className="db-layout">
      {/* Sidebar for Desktop */}
      <aside className="db-sidebar">
        <div className="db-brand">
          <span className="brand-icon">🛡️</span>
          <h2>Vault</h2>
        </div>
        <nav className="db-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`db-nav-item ${pathname === item.path ? 'active' : ''}`}
            >
              <span className="item-icon">{item.icon}</span>
              <span className="item-text">{item.name}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Header and Main Shell */}
      <div className="db-main-container">
        <header className="db-header">
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          <div className="header-title">
            <h1>{navItems.find((i) => i.path === pathname)?.name || 'Dashboard'}</h1>
          </div>
          <div className="header-profile">
            <div className="profile-avatar">👤</div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
            <nav className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-header">
                <span className="brand-icon">🛡️</span>
                <h2>Vault Menu</h2>
              </div>
              <div className="drawer-nav">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`drawer-nav-item ${pathname === item.path ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>{item.icon}</span> {item.name}
                  </Link>
                ))}
              </div>
              <button onClick={handleLogout} className="btn-logout mobile-logout">
                🚪 Logout
              </button>
            </nav>
          </div>
        )}

        <main className="db-content">{children}</main>
      </div>
    </div>
  )
}
