'use client'

import { useEffect, useState } from 'react'

/**
 * Missed days the reader marked "Skipped (sick / rest)" from Plan (Wave 5,
 * Today › missed day). Kept on the device, like route names: Today's week
 * card then draws the day as a rest stub and stops counting it as missed.
 */
const KEY = 'runomics-skipped-days'
const EVENT = 'runomics:skipped-change'

export function readSkippedDays(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((d): d is string => typeof d === 'string') : [])
  } catch {
    return new Set()
  }
}

export function setDaySkipped(date: string, skipped: boolean): void {
  const days = readSkippedDays()
  if (skipped) days.add(date)
  else days.delete(date)
  try {
    localStorage.setItem(KEY, JSON.stringify([...days].sort()))
  } catch {
    // Storage is off: the mark lasts until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT))
}

/** The skipped days, read after mount and kept in step across components. */
export function useSkippedDays(): Set<string> {
  const [days, setDays] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    const sync = () => setDays(readSkippedDays())
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return days
}
