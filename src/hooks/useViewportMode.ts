import { useCallback, useEffect, useState } from 'react'

export type ViewportMode = 'forced' | 'responsive'

const STORAGE_KEY = 'wc26:viewport'

function readStoredViewport(): ViewportMode {
  if (typeof window === 'undefined') return 'forced'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'forced' || stored === 'responsive') return stored
  } catch {
    // ignore storage access errors (private mode, etc.)
  }
  return 'forced'
}

/**
 * Persisted viewport mode for the board page. "forced" widens the viewport to a
 * fixed desktop width so phones render the wide board scaled down; "responsive"
 * keeps the device's native viewport.
 */
export function useViewportMode(): {
  viewportMode: ViewportMode
  toggleViewportMode: () => void
} {
  const [viewportMode, setViewportMode] = useState<ViewportMode>(readStoredViewport)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, viewportMode)
    } catch {
      // ignore storage access errors
    }
  }, [viewportMode])

  const toggleViewportMode = useCallback(() => {
    setViewportMode((current) => (current === 'forced' ? 'responsive' : 'forced'))
  }, [])

  return { viewportMode, toggleViewportMode }
}
