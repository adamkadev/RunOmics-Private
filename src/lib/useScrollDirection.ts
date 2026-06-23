'use client'

import { useEffect, useState } from 'react'

const HIDE_THRESHOLD = 60
const TOP_THRESHOLD = 100

// Binary hide/show for a fixed header: hides once the page has scrolled down
// past HIDE_THRESHOLD, reveals on any upward scroll or near the top of the page.
export function useScrollDirection(): boolean {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const goingDown = y > lastY
      lastY = y

      if (y < TOP_THRESHOLD) {
        setHidden(false)
        return
      }
      if (goingDown && y > HIDE_THRESHOLD) {
        setHidden(true)
      } else if (!goingDown) {
        setHidden(false)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return hidden
}
