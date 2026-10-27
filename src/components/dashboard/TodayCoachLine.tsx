'use client'

import { sessionWords, useCoachWords } from '@/components/coaching/useCoachWords'

/** Up to the first sentence's end: the card has room for one line, Plan for the rest. */
export function firstSentence(text: string): string {
  const match = text.match(/^.+?[.!?…](?=\s|$)/u)
  return (match?.[0] ?? text).trim()
}

export function TodayCoachLine({ sessionKey, title }: { sessionKey: string; title: string }) {
  const words = sessionWords(useCoachWords(), sessionKey, title)
  const line = words?.description || words?.notes[0]
  if (!line) return null
  return (
    <span className="line-clamp-2 text-footnote text-[var(--text-2)] text-pretty" data-testid="session-coach-line">
      {firstSentence(line)}
    </span>
  )
}
