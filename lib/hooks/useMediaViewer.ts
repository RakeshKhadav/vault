import { useState, useEffect, useCallback } from 'react'

export interface MediaFile {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: string
  uploadedAt: string
  thumbnailUrl?: string | null
  viewUrl?: string | null
  streamUrl?: string | null
}

export interface UseMediaViewerProps {
  files: MediaFile[]
}

export function useMediaViewer({ files }: UseMediaViewerProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, { viewUrl?: string | null; previewUrl?: string | null; streamUrl?: string | null }>>({})
  const [highResLoaded, setHighResLoaded] = useState(false)

  const activeMedia = activeMediaIndex !== null ? files[activeMediaIndex] : null
  const resolvedForActive = activeMedia ? resolvedUrls[activeMedia.id] : null

  // Navigation handlers
  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (activeMediaIndex === null || files.length === 0) return
    setActiveMediaIndex((prev) => (prev === 0 ? files.length - 1 : prev! - 1))
    setShowDetails(false)
  }, [activeMediaIndex, files])

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (activeMediaIndex === null || files.length === 0) return
    setActiveMediaIndex((prev) => (prev === files.length - 1 ? 0 : prev! + 1))
    setShowDetails(false)
  }, [activeMediaIndex, files])

  const handleClose = useCallback(() => {
    setActiveMediaIndex(null)
    setShowDetails(false)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (activeMediaIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeMediaIndex, handlePrev, handleNext, handleClose])

  // Resolve a single file's high-res URL (used for active media + prefetching)
  const resolveFileUrl = useCallback(async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/url`)
      if (!res.ok) throw new Error('Failed to resolve URL')
      const data = await res.json()
      setResolvedUrls((prev) => ({
        ...prev,
        [fileId]: data,
      }))
      return data as { viewUrl?: string | null; previewUrl?: string | null; streamUrl?: string | null }
    } catch (err) {
      console.error('Error resolving lazy URL:', err)
      return null
    }
  }, [])

  // Public prefetch function exposed for hover-triggered resolution from the grid
  const prefetchUrl = useCallback((fileId: string) => {
    setResolvedUrls((prev) => {
      if (prev[fileId]) return prev // Already resolved, skip
      return prev
    })
    // Check if already resolved via closure to avoid unnecessary fetches
    if (resolvedUrls[fileId]) return
    resolveFileUrl(fileId)
  }, [resolvedUrls, resolveFileUrl])

  // Fetch high-res URL on demand when active media changes
  useEffect(() => {
    setHighResLoaded(false)
    if (!activeMedia) return
    if (resolvedUrls[activeMedia.id]) return // Already resolved (e.g. via hover prefetch)

    let isMounted = true
    async function resolve() {
      const data = await resolveFileUrl(activeMedia!.id)
      if (!isMounted || !data) return
    }

    resolve()
    return () => {
      isMounted = false
    }
  }, [activeMediaIndex, activeMedia, resolvedUrls, resolveFileUrl])

  // Background prefetch: resolve URLs for adjacent files when viewer is open
  useEffect(() => {
    if (activeMediaIndex === null || files.length === 0) return

    const indicesToPrefetch = [
      (activeMediaIndex + 1) % files.length,
      (activeMediaIndex - 1 + files.length) % files.length,
      (activeMediaIndex + 2) % files.length,
      (activeMediaIndex - 2 + files.length) % files.length,
    ]

    // Stagger prefetches to avoid hammering the server
    const timeouts: ReturnType<typeof setTimeout>[] = []
    indicesToPrefetch.forEach((idx, i) => {
      const file = files[idx]
      if (!file || resolvedUrls[file.id]) return
      timeouts.push(setTimeout(() => resolveFileUrl(file.id), (i + 1) * 150))
    })

    return () => timeouts.forEach(clearTimeout)
  }, [activeMediaIndex, files, resolvedUrls, resolveFileUrl])

  // Preload already-resolved adjacent images into browser cache for instant display
  useEffect(() => {
    if (activeMediaIndex === null || files.length === 0) return

    const indicesToPreload = [
      (activeMediaIndex + 1) % files.length,
      (activeMediaIndex - 1 + files.length) % files.length,
    ]

    indicesToPreload.forEach((idx) => {
      const file = files[idx]
      if (file && file.mimeType.startsWith('image/')) {
        const displayUrl = resolvedUrls[file.id]?.previewUrl || resolvedUrls[file.id]?.viewUrl
        if (displayUrl) {
          const img = new Image()
          img.src = displayUrl
        }
      }
    })
  }, [activeMediaIndex, files, resolvedUrls])

  return {
    activeMediaIndex,
    setActiveMediaIndex,
    showDetails,
    setShowDetails,
    resolvedUrls,
    setResolvedUrls,
    highResLoaded,
    setHighResLoaded,
    activeMedia,
    resolvedForActive,
    handlePrev,
    handleNext,
    handleClose,
    prefetchUrl,
  }
}
