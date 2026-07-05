'use client'

import { createContext, useContext, useEffect, useState } from 'react'

/* The global bottom tab bar and a fullscreen map overlay are both
   `position: fixed` siblings at different points in the tree. In practice
   (confirmed on-device and in headless Chromium) the tab bar can still
   paint - and receive taps - on top of a higher z-index fullscreen overlay,
   leaving fullscreen controls inaccessible. Rather than fight that stacking
   behavior, fullscreen views explicitly ask the tab bar to hide itself. */

const FullscreenChromeContext = createContext<((hidden: boolean) => void) | null>(null)

export function FullscreenChromeProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false)

  return (
    <FullscreenChromeContext.Provider value={setHidden}>
      <FullscreenChromeHiddenContext.Provider value={hidden}>
        {children}
      </FullscreenChromeHiddenContext.Provider>
    </FullscreenChromeContext.Provider>
  )
}

const FullscreenChromeHiddenContext = createContext(false)

export function useFullscreenChromeHidden() {
  return useContext(FullscreenChromeHiddenContext)
}

/** Call with `true` while a fullscreen overlay is open, `false` (or unmount) when it closes. */
export function useSetFullscreenChromeHidden(hidden: boolean) {
  const setHidden = useContext(FullscreenChromeContext)

  useEffect(() => {
    if (!setHidden) return
    setHidden(hidden)
    return () => setHidden(false)
  }, [setHidden, hidden])
}
