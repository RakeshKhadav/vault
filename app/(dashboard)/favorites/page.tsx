'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useMediaViewer } from '@/lib/hooks/useMediaViewer'
import { MediaViewer } from '@/components/gallery/MediaViewer'
import { MediaGrid } from '@/components/gallery/MediaGrid'
import { GalleryToolbar } from '@/components/gallery/GalleryToolbar'

interface MediaFile {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: string
  isFavorite: boolean
  thumbnailFileId: string | null
  uploadedAt: string
  thumbnailUrl?: string | null
  viewUrl?: string | null
  streamUrl?: string | null
}

function FavoritesPageContent() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const typeFilter = (searchParams.get('type') || 'all') as 'all' | 'image' | 'video'
  const debouncedSearch = searchParams.get('search') || ''
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const datePreset = (searchParams.get('preset') || 'anytime') as 'anytime' | 'today' | 'week' | 'month' | 'year'

  const [searchQuery, setSearchQuery] = useState(debouncedSearch)

  useEffect(() => {
    setSearchQuery(debouncedSearch)
  }, [debouncedSearch])

  const updateFilters = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('cursor')

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all' || (key === 'preset' && value === 'anytime')) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  const observerRef = useRef<IntersectionObserver | null>(null)

  const applyDatePreset = (preset: 'anytime' | 'today' | 'week' | 'month' | 'year') => {
    const now = new Date()
    let start = ''
    let end = ''
    
    if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0]
      start = todayStr
      end = todayStr
    } else if (preset === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      start = oneWeekAgo.toISOString().split('T')[0]
      end = now.toISOString().split('T')[0]
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      start = firstDay.toISOString().split('T')[0]
      end = now.toISOString().split('T')[0]
    } else if (preset === 'year') {
      const firstDayOfYear = new Date(now.getFullYear(), 0, 1)
      start = firstDayOfYear.toISOString().split('T')[0]
      end = now.toISOString().split('T')[0]
    }

    updateFilters({
      preset: preset === 'anytime' ? null : preset,
      startDate: start || null,
      endDate: end || null
    })
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery !== debouncedSearch) {
        updateFilters({ search: searchQuery })
      }
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery, debouncedSearch, updateFilters])

  const fetchFiles = useCallback(async (isFirstLoad = true, currentCursor: string | null = null) => {
    if (isFirstLoad) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const params = new URLSearchParams()
      params.append('limit', '24')
      params.append('favorite', 'true')
      if (typeFilter !== 'all') {
        params.append('type', typeFilter)
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch)
      }
      if (startDate) {
        params.append('startDate', startDate)
      }
      if (endDate) {
        params.append('endDate', endDate)
      }
      if (currentCursor) {
        params.append('cursor', currentCursor)
      }

      const res = await fetch(`/api/files?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch files')

      const data = await res.json()

      if (isFirstLoad) {
        setFiles(data.files)
      } else {
        setFiles((prev) => [...prev, ...data.files])
      }
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    } catch (err) {
      console.error('Error loading favorites files:', err)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [typeFilter, debouncedSearch, startDate, endDate])

  useEffect(() => {
    fetchFiles(true, null)
  }, [fetchFiles])

  const lastLoadedRef = useRef(Date.now())

  useEffect(() => {
    lastLoadedRef.current = Date.now()
  }, [files])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const ageMs = Date.now() - lastLoadedRef.current
        if (ageMs > 45 * 60 * 1000) {
          fetchFiles(true, null)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    const interval = setInterval(() => {
      const ageMs = Date.now() - lastLoadedRef.current
      if (ageMs > 45 * 60 * 1000) {
        fetchFiles(true, null)
      }
    }, 5 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [fetchFiles])

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isLoadingMore) return
      if (observerRef.current) observerRef.current.disconnect()

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && cursor) {
          fetchFiles(false, cursor)
        }
      })

      if (node) observerRef.current.observe(node)
    },
    [isLoading, isLoadingMore, hasMore, cursor, fetchFiles]
  )

  const viewer = useMediaViewer({ files })

  const toggleFavorite = async (fileId: string, index: number, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const file = files[index]
    if (!file) return

    setFiles((prev) => prev.filter((_, i) => i !== index))
    
    if (viewer.activeMediaIndex === index) {
      viewer.setActiveMediaIndex(null)
    } else if (viewer.activeMediaIndex !== null && viewer.activeMediaIndex > index) {
      viewer.setActiveMediaIndex((prev) => prev! - 1)
    }

    try {
      const res = await fetch(`/api/files/${fileId}/favorite`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove from favorites')
    } catch (err) {
      console.error(err)
      fetchFiles(true, null)
    }
  }

  const handleDelete = async (fileId: string, index: number, event?: React.MouseEvent) => {
    event?.stopPropagation()
    if (!confirm('Are you sure you want to move this file to trash?')) return

    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete file')

      setFiles((prev) => prev.filter((_, i) => i !== index))
      viewer.setActiveMediaIndex(null)
    } catch (err) {
      console.error(err)
      alert('Failed to delete file.')
    }
  }

  return (
    <div className="page-container">
      <GalleryToolbar
        searchPlaceholder="Search favorites..."
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={(type) => updateFilters({ type: type === 'all' ? null : type })}
        datePreset={datePreset}
        onDatePresetChange={(preset) => applyDatePreset(preset)}
      />

      {files.length === 0 && !isLoading ? (
        <div className="gallery-placeholder">
          <p className="placeholder-icon">⊙</p>
          <h2>The gallery is quiet.</h2>
          <p className="placeholder-description">
            {searchQuery || typeFilter !== 'all' || startDate || endDate
              ? 'No matching favorited files found in the archive.'
              : 'Add stars to your favorite memories to collect them in this exhibit.'}
          </p>
        </div>
      ) : (
        <MediaGrid
          files={files}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          isSelectMode={false}
          selectedIds={new Set()}
          toggleFileSelection={() => {}}
          setActiveMediaIndex={viewer.setActiveMediaIndex}
          toggleFavorite={toggleFavorite}
          onPrefetchUrl={viewer.prefetchUrl}
          lastElementRef={lastElementRef}
        />
      )}

      <MediaViewer
        activeMediaIndex={viewer.activeMediaIndex}
        files={files}
        resolvedUrls={viewer.resolvedUrls}
        highResLoaded={viewer.highResLoaded}
        setHighResLoaded={viewer.setHighResLoaded}
        showDetails={viewer.showDetails}
        setShowDetails={viewer.setShowDetails}
        handlePrev={viewer.handlePrev}
        handleNext={viewer.handleNext}
        handleClose={viewer.handleClose}
        onToggleFavorite={toggleFavorite}
        onDelete={handleDelete}
      />
    </div>
  )
}

export default function FavoritesPage() {
  return (
    <Suspense fallback={<div className="page-container">Loading favorites...</div>}>
      <FavoritesPageContent />
    </Suspense>
  )
}
