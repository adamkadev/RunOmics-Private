'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { CheckIn } from '@/domain/wellness/checkIn'
import { isClientFirebaseConfigured } from './firebaseConfig'
import { useOwnerAuth } from './useOwnerAuth'
import { useToday } from './useToday'
import { readCheckInDay, writeCheckInDay } from './wellness'

export type CheckInDay = { status: 'loading' } | { status: 'ready'; entry: CheckIn | null } | { status: 'failed' }

const days = new Map<string, CheckInDay>()
const listeners = new Set<() => void>()

function publish() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function load(date: string) {
  const known = days.get(date)
  if (known && known.status !== 'failed') return
  days.set(date, { status: 'loading' })
  readCheckInDay(date)
    .then((entry) => days.set(date, { status: 'ready', entry }))
    .catch(() => days.set(date, { status: 'failed' }))
    .finally(publish)
}

/** Shown at once; a failed write puts back what was there, unless a later answer has already replaced it. */
export async function saveCheckIn(date: string, entry: CheckIn | null): Promise<void> {
  const previous = days.get(date)
  const next: CheckInDay = { status: 'ready', entry }
  days.set(date, next)
  publish()
  try {
    await writeCheckInDay(date, entry)
  } catch (error) {
    if (days.get(date) === next) {
      if (previous) days.set(date, previous)
      else days.delete(date)
      publish()
    }
    throw error
  }
}

/** The check-in card and the readiness card share one read of today's answers; anyone but the owner gets nothing. */
export function useTodayCheckIn(serverToday: string): { date: string; isOwner: boolean; day: CheckInDay | undefined } {
  const date = useToday(serverToday)
  const { isOwner } = useOwnerAuth()
  useEffect(() => {
    if (isOwner && isClientFirebaseConfigured) load(date)
  }, [isOwner, date])
  const day = useSyncExternalStore(subscribe, () => (isOwner ? days.get(date) : undefined), () => undefined)
  return { date, isOwner, day }
}
