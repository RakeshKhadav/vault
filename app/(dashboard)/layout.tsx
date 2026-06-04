'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Image as ImageIcon,
  Upload,
  Star,
  Trash2,
  Settings,
  Users,
  Folder,
  Cloud,
  Database,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ShieldAlert
} from 'lucide-react'
import { ModalProvider } from '@/components/ModalProvider'

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
    { name: 'Gallery', path: '/dashboard', icon: ImageIcon },
    { name: 'Upload', path: '/upload', icon: Upload },
    { name: 'Favorites', path: '/favorites', icon: Star },
    { name: 'Trash', path: '/trash', icon: Trash2 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ]

  const adminNavItems = [
    { name: 'Admin Users', path: '/admin/users', icon: Users },
    { name: 'Admin Files', path: '/admin/files', icon: Folder },
    { name: 'Admin Backups', path: '/admin/backups', icon: Cloud },
    { name: 'Storage Nodes', path: '/admin/storage-nodes', icon: Database },
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
    <ModalProvider>
      <div className="db-layout">
        {/* Sidebar for Desktop */}
        <aside className="db-sidebar">
          <div className="db-brand flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[var(--auth-accent)]" />
            <h2>Vault</h2>
          </div>
          <nav className="db-nav">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`db-nav-item ${pathname === item.path ? 'active' : ''} flex items-center gap-3`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="item-text">{item.name}</span>
                </Link>
              )
            })}
          </nav>
          <div className="sidebar-footer">
            <button onClick={handleLogout} className="btn-logout flex items-center justify-center gap-2">
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Header and Main Shell */}
        <div className="db-main-container">
          <header className="db-header">
            <button
              className="mobile-menu-toggle flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="header-title">
              <h1>{navItems.find((i) => i.path === pathname)?.name || 'Dashboard'}</h1>
            </div>
            <div className="header-actions">
              <button 
                onClick={toggleTheme} 
                className="theme-toggle-btn flex items-center justify-center"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </header>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
              <nav className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[var(--auth-accent)]" />
                  <h2>Vault</h2>
                </div>
                <div className="drawer-nav">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={`drawer-nav-item ${pathname === item.path ? 'active' : ''} flex items-center gap-3`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon size={16} className="shrink-0" />
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
                <button onClick={handleLogout} className="btn-logout mobile-logout flex items-center justify-center gap-2">
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          )}

          <main className="db-content">{children}</main>
        </div>
      </div>
    </ModalProvider>
  )
}
