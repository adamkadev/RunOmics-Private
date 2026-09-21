'use client'

import { useCallback } from 'react'

const PATTERNS = {
  light: 10,
  success: [10, 40, 10],
  celebration: [10, 30, 10, 30, 20],
} as const

export type HapticPattern = keyof typeof PATTERNS

export function useHaptic() {
  return useCallback((pattern: HapticPattern) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(PATTERNS[pattern] as number | number[])
  }, [])
}
