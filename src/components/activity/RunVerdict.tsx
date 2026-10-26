import type { ActivityDetailView } from './activityViews'
import type { ActivityType } from '@/domain/activity/types'
import { runVerdictTone, type VerdictTone as RunTone } from '@/domain/activity/runVerdict'
import { cardClass } from '@/components/ui/Card'
import { VerdictBlock, type VerdictTone } from '@/components/ui/Verdict'
import type { ReactNode } from 'react'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

interface Props {
  activity: ActivityDetailView
  /** The session the run was planned as, where RunOmics' own guess at its type gives way to it. */
  type?: ActivityType
  aiVerdict: Insight | null
  children?: ReactNode
}

export const RUN_CHIP_CLASS =
  'hit-44 inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-full bg-[var(--fill-3)] px-3 py-1 text-[13px] text-foreground'

const STATUS_TONE: Record<RunTone, VerdictTone> = {
  positive: 'accent',
  neutral: 'accent',
  caution: 'warn',
}

export function RunVerdict({ activity, type = activity.type, aiVerdict, children }: Props) {
  const v = t.activity.verdict
  const tone = runVerdictTone({ ...activity, type })
  const session = v.headline[tone](t.activityTypes[type])
  const eyebrow = `${v.eyebrow[tone]} · ${session}`

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="run-verdict">
      <VerdictBlock
        tone={STATUS_TONE[tone]}
        eyebrow={eyebrow}
        headline={aiVerdict?.headline ?? null}
        body={aiVerdict?.body ? <span data-testid="run-verdict-body">{aiVerdict.body}</span> : undefined}
      />
      {children && (
        <div className="flex flex-wrap gap-2" data-testid="run-chips">
          {children}
        </div>
      )}
    </section>
  )
}
