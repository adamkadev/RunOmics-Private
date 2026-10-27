'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { SkipReason } from '@/domain/wellness/checkIn'
import { isClientFirebaseConfigured } from './firebaseConfig'
import { noteSkipped } from './useCheckIn'
import { useOwnerAuth } from './useOwnerAuth'
import { readSkippedDays, writeSkippedDay } from './wellness'

/** Where one browser kept its marks before they moved to Firestore; read once, then cleared. */
export const LEGACY_KEY = 'runomics-skipped-days'

const EMPTY: ReadonlyMap<string, SkipReason> = new Map()
let days: ReadonlyMap<string, SkipReason> = EMPTY
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function publish(next: ReadonlyMap<string, SkipReason>) {
  days = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function legacyMarks(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) : []
  } catch {
    return []
  }
}

/** The old marks carried no reason; they were offered as "sick / rest", and rest is the one that claims nothing. */
async function migrate(remote: Map<string, SkipReason>): Promise<void> {
  const pending = legacyMarks().filter((date) => !remote.has(date))
  await Promise.all(pending.map((date) => writeSkippedDay(date, 'rest')))
  for (const date of pending) remote.set(date, 'rest')
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Storage is off: there was nothing to migrate either.
  }
}

function load(): Promise<void> {
  loading ??= readSkippedDays()
    .then(async (remote) => {
      // Shown while they move, and kept in view and in the browser if Firestore refuses them.
      const shown = new Map(remote)
      for (const date of legacyMarks()) if (!shown.has(date)) shown.set(date, 'rest')
      publish(shown)
      await migrate(remote)
      publish(remote)
    })
    .catch(() => {
      loading = null
    })
  return loading
}

/** Shown at once; a failed write puts back what was there. */
export async function setDaySkipped(date: string, reason: SkipReason | null): Promise<void> {
  const previous = days
  const next = new Map(days)
  if (reason) next.set(date, reason)
  else next.delete(date)
  publish(next)
  try {
    await writeSkippedDay(date, reason)
    noteSkipped(date, reason)
  } catch (error) {
    if (days === next) publish(previous)
    throw error
  }
}

/** The owner's skipped days; anyone else, who cannot read them, gets none. */
export function useSkippedDays(): ReadonlyMap<string, SkipReason> {
  const { isOwner } = useOwnerAuth()
  useEffect(() => {
    if (isOwner && isClientFirebaseConfigured) void load()
  }, [isOwner])
  return useSyncExternalStore(subscribe, () => (isOwner ? days : EMPTY), () => EMPTY)
}
