import { useState, useEffect, useRef } from 'react'

export interface TouchGesturesProps {
  activeMediaIndex: number | null
  filesLength: number
  handlePrev: () => void
  handleNext: () => void
}

export function useTouchGestures({
  activeMediaIndex,
  filesLength,
  handlePrev,
  handleNext,
  handleClose,
}: TouchGesturesProps & { handleClose: () => void }) {
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })

  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const touchEndY = useRef(0)
  const touchStartDist = useRef(0)
  const baseZoomScale = useRef(1)
  const lastTap = useRef(0)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  // Reset zoom/pan when active media changes
  useEffect(() => {
    setZoomScale(1)
    setPanOffset({ x: 0, y: 0 })
  }, [activeMediaIndex])

  // Touch event handlers for swipe, pinch-to-zoom, and drag-to-pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      touchStartDist.current = dist
      baseZoomScale.current = zoomScale
    } else if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      
      // For panning on mobile
      if (zoomScale > 1) {
        isDragging.current = true
        dragStart.current = {
          x: e.touches[0].clientX - panOffset.x,
          y: e.touches[0].clientY - panOffset.y
        }
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const factor = dist / touchStartDist.current
      setZoomScale(Math.min(Math.max(1, baseZoomScale.current * factor), 3))
    } else if (e.touches.length === 1 && isDragging.current && zoomScale > 1) {
      const nextX = e.touches[0].clientX - dragStart.current.x
      const nextY = e.touches[0].clientY - dragStart.current.y
      setPanOffset({ x: nextX, y: nextY })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartDist.current = 0
    }
    isDragging.current = false
    
    if (e.touches.length === 0 && e.changedTouches.length === 1) {
      touchEndX.current = e.changedTouches[0].clientX
      touchEndY.current = e.changedTouches[0].clientY
      
      if (zoomScale === 1) {
        const diffX = touchStartX.current - touchEndX.current
        const diffY = touchStartY.current - touchEndY.current
        
        // If swiped down vertically by a significant amount, trigger dismiss
        if (Math.abs(diffY) > 80 && Math.abs(diffY) > Math.abs(diffX)) {
          if (diffY < 0) {
            handleClose()
            return
          }
        }
        
        if (diffX > 50) {
          handleNext()
        } else if (diffX < -50) {
          handlePrev()
        }
      }
    }
  }

  // Double-tap or double-click to toggle zoom between 1 and 2.5
  const handleMediaTap = (e: React.MouseEvent) => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      if (zoomScale > 1) {
        setZoomScale(1)
        setPanOffset({ x: 0, y: 0 })
      } else {
        setZoomScale(2.5)
      }
    }
    lastTap.current = now
  }

  // Desktop drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale > 1) {
      isDragging.current = true
      dragStart.current = {
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current && zoomScale > 1) {
      setPanOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      })
    }
  }

  const handleMouseUp = () => {
    isDragging.current = false
  }

  // Desktop mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = 0.15
    const delta = e.deltaY < 0 ? 1 : -1
    setZoomScale((prev) => {
      const next = Math.min(Math.max(1, prev + delta * zoomFactor), 3)
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 })
      }
      return next
    })
  }

  const resetGestures = () => {
    setZoomScale(1)
    setPanOffset({ x: 0, y: 0 })
  }

  return {
    zoomScale,
    panOffset,
    setZoomScale,
    setPanOffset,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMediaTap,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    resetGestures,
  }
}
