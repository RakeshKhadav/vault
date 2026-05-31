'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    let currentTheme: 'dark' | 'light' = 'dark'
    if (savedTheme === 'system') {
      currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } else {
      currentTheme = savedTheme as 'dark' | 'light'
    }
    setTheme(currentTheme)
  }, [])

  useEffect(() => {
    const handleGlobalThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent
      setTheme(customEvent.detail)
    }
    window.addEventListener('theme-changed', handleGlobalThemeChange)
    return () => window.removeEventListener('theme-changed', handleGlobalThemeChange)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: nextTheme }))
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('Unauthorized')
      })
      .then((data) => {
        if (data?.user?.role === 'ADMIN') {
          setIsAdmin(true)
        }
      })
      .catch((err) => console.error('Error checking admin status:', err))
  }, [])

  const baseNavItems = [
    { name: 'Gallery', path: '/dashboard', icon: '🖼️' },
    { name: 'Upload', path: '/upload', icon: '📤' },
    { name: 'Favorites', path: '/favorites', icon: '⭐' },
    { name: 'Trash', path: '/trash', icon: '🗑️' },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
  ]

  const adminNavItems = [
    { name: 'Admin Users', path: '/admin/users', icon: '👥' },
    { name: 'Admin Files', path: '/admin/files', icon: '📁' },
    { name: 'Admin Backups', path: '/admin/backups', icon: '☁️' },
    { name: 'Storage Nodes', path: '/admin/storage-nodes', icon: '💾' },
  ]

  const navItems = isAdmin ? [...baseNavItems, ...adminNavItems] : baseNavItems

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
          <h2>⊙ Vault</h2>
        </div>
        <nav className="db-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`db-nav-item ${pathname === item.path ? 'active' : ''}`}
            >
              <span className="item-text">{item.name}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            Logout
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
          <div className="header-actions">
            <button 
              onClick={toggleTheme} 
              className="theme-toggle-btn"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☼' : '☾'}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
            <nav className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-header">
                <h2>Vault</h2>
              </div>
              <div className="drawer-nav">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`drawer-nav-item ${pathname === item.path ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
              <button onClick={handleLogout} className="btn-logout mobile-logout">
                Logout
              </button>
            </nav>
          </div>
        )}

        <main className="db-content">{children}</main>
      </div>
    </div>
  )
}
