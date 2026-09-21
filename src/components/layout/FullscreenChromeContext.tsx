'use client'

import { createContext, useContext, useEffect, useState } from 'react'

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

export function useSetFullscreenChromeHidden(hidden: boolean) {
  const setHidden = useContext(FullscreenChromeContext)

  useEffect(() => {
    if (!setHidden) return
    setHidden(hidden)
    return () => setHidden(false)
  }, [setHidden, hidden])
}
