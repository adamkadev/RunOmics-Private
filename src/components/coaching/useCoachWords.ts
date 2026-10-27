'use client'

import { useEffect, useState } from 'react'
import type { CoachSessionWords, CoachWords } from '@/application/coaching/GetCoachWords'

export const COACH_WORDS_PATH = '/api/coaching/words'

/** Plan and Today mount several readers; one request serves them all for a few minutes. */
const FRESH_MS = 5 * 60_000

let cached: { at: number; read: Promise<CoachWords | null>; words?: CoachWords | null } | null = null

async function fetchCoachWords(): Promise<CoachWords | null> {
  try {
    const response = await fetch(COACH_WORDS_PATH)
    if (!response.ok) return null
    const data = (await response.json()) as ({ available: true } & CoachWords) | { available: false }
    if (!data.available) return null
    return { block: data.block, weeks: data.weeks, sessions: data.sessions }
  } catch {
    return null
  }
}

export function readCoachWords(now = Date.now()): Promise<CoachWords | null> {
  if (!cached || now - cached.at > FRESH_MS) {
    const entry: NonNullable<typeof cached> = { at: now, read: fetchCoachWords() }
    void entry.read.then((words) => {
      entry.words = words
    })
    cached = entry
  }
  return cached.read
}

export function forgetCoachWords(): void {
  cached = null
}

/** Starts from a read already made: Plan remounts each week it pages to, which would flash the generic name back. */
export function useCoachWords(enabled = true): CoachWords | null {
  const [words, setWords] = useState<CoachWords | null>(() => (enabled ? cached?.words ?? null : null))
  useEffect(() => {
    if (!enabled) return
    let live = true
    void readCoachWords().then((read) => {
      if (live) setWords(read)
    })
    return () => {
      live = false
    }
  }, [enabled])
  return words
}

/** What the card shows: a description that only repeats the session's title says nothing. */
export function sessionWords(words: CoachWords | null, id: string, title: string): CoachSessionWords | null {
  const session = words?.sessions[id]
  if (!session) return null
  const description = sameText(session.description, title) ? '' : session.description
  return description || session.notes.length > 0 ? { description, notes: session.notes } : null
}

const normalise = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

function sameText(a: string, b: string): boolean {
  return normalise(a) === normalise(b)
}
