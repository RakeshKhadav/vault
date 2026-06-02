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
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, { viewUrl?: string | null; streamUrl?: string | null }>>({})
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

  // Fetch dynamic URL on demand when active media changes
  useEffect(() => {
    setHighResLoaded(false)
    if (!activeMedia || resolvedForActive) return

    let isMounted = true
    async function resolveUrl() {
      try {
        const res = await fetch(`/api/files/${activeMedia!.id}/url`)
        if (!res.ok) throw new Error('Failed to resolve URL')
        const data = await res.json()
        if (isMounted) {
          setResolvedUrls((prev) => ({
            ...prev,
            [activeMedia!.id]: data,
          }))
        }
      } catch (err) {
        console.error('Error resolving lazy URL:', err)
      }
    }

    resolveUrl()
    return () => {
      isMounted = false
    }
  }, [activeMediaIndex, activeMedia, resolvedForActive])

  // Preload next and previous high-resolution images
  useEffect(() => {
    if (activeMediaIndex === null || files.length === 0) return

    const preloadImage = (url: string) => {
      const img = new Image()
      img.src = url
    }

    // Preload previous image
    const prevIndex = activeMediaIndex === 0 ? files.length - 1 : activeMediaIndex - 1
    const prevFile = files[prevIndex]
    if (prevFile && prevFile.mimeType.startsWith('image/')) {
      const prevUrl = resolvedUrls[prevFile.id]?.viewUrl
      if (prevUrl) preloadImage(prevUrl)
    }

    // Preload next image
    const nextIndex = activeMediaIndex === files.length - 1 ? 0 : activeMediaIndex + 1
    const nextFile = files[nextIndex]
    if (nextFile && nextFile.mimeType.startsWith('image/')) {
      const nextUrl = resolvedUrls[nextFile.id]?.viewUrl
      if (nextUrl) preloadImage(nextUrl)
    }
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
  }
}
