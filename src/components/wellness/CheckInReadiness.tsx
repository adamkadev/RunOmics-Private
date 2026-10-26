'use client'

import { readCheckInConcerns } from '@/domain/wellness/checkIn'
import { worseTone, type ReadinessTone } from '@/domain/training/readiness'
import { useTodayCheckIn } from '@/lib/useCheckIn'
import { t } from '@/i18n'
import { concernCopy } from './checkInWords'

export interface ReadinessWords {
  tone: ReadinessTone
  color: string
  band: string | null
  line: string
  headline: string | null
  body: string | null
  yesterday: boolean
}

/**
 * The readiness card's words, as the server wrote them from the load, unless the owner's check-in
 * this morning gives a reason to ease off: then its reason leads, and the load numbers stay as they are.
 */
export function CheckInReadiness({ today, words }: { today: string; words: ReadinessWords }) {
  const { day } = useTodayCheckIn(today)
  const reading = day?.status === 'ready' ? readCheckInConcerns(day.entry) : null
  const concern = reading && concernCopy(reading)
  const tone = reading ? worseTone(words.tone, reading.tone) : words.tone
  const color = reading ? 'var(--warn)' : words.color
  const line = concern?.line ?? words.line
  const headline = concern?.headline ?? words.headline
  const body = concern ? concern.body : words.body

  return (
    <>
      <p className="flex items-center gap-1.5 text-eyebrow uppercase" style={{ color }} data-testid="readiness-status" data-tone={tone}>
        <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <span>
          {words.band ? `${words.band} · ${line}` : line}
        </span>
      </p>
      {headline && (
        <div className="flex flex-col gap-2.5" data-testid="readiness-verdict" data-source={concern ? 'check-in' : 'load'}>
          {words.yesterday && !concern && (
            <p className="-mb-1.5 text-eyebrow uppercase text-muted-foreground" data-testid="verdict-yesterday">
              {t.dashboard.readiness.yesterday}
            </p>
          )}
          <p className="text-title-3 text-foreground [text-wrap:pretty]">{headline}</p>
          {body && <p className="text-[15px] leading-5 tracking-[-0.015rem] text-[var(--text-2)] [text-wrap:pretty]">{body}</p>}
          {concern && <p className="text-footnote text-muted-foreground">{t.wellness.readiness.why}</p>}
        </div>
      )}
    </>
  )
}
