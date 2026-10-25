'use client'

import { useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import {
  CHECK_IN_SCORES,
  isCompleteCheckIn,
  isEmptyCheckIn,
  NIGGLE_SIDES,
  NIGGLE_SITES,
  PAIN_MAX,
  SCORE_MAX,
  type CheckIn,
  type CheckInScore,
  type Niggle,
} from '@/domain/wellness/checkIn'
import { saveCheckIn, useTodayCheckIn } from '@/lib/useCheckIn'
import { useMounted } from '@/lib/useMounted'
import { Button } from '@/components/ui/Button'
import { cardClass } from '@/components/ui/Card'
import { Toast, useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { checkInSummary } from './checkInWords'

const hiddenKey = (date: string) => `ro-checkin-hidden:${date}`

function hiddenFor(date: string): boolean {
  try {
    return window.localStorage.getItem(hiddenKey(date)) !== null
  } catch {
    return false
  }
}

const SCORE_VALUES = Array.from({ length: SCORE_MAX }, (_, i) => i + 1)
const PAIN_VALUES = Array.from({ length: PAIN_MAX + 1 }, (_, i) => i)

const choiceClass = (selected: boolean) =>
  cn(
    'transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    selected ? 'bg-foreground font-semibold text-background' : 'bg-[var(--fill-3)] font-medium text-foreground',
  )

function Chip({ selected, onClick, children, testId }: { selected: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-testid={testId}
      className={cn('hit-44 inline-flex h-8 items-center rounded-full px-3 text-[13px] whitespace-nowrap', choiceClass(selected))}
    >
      {children}
    </button>
  )
}

function ScoreRow({ field, value, onPick }: { field: CheckInScore; value: number | undefined; onPick: (value: number) => void }) {
  const s = t.wellness.checkIn.scores[field]
  return (
    <div className="flex items-center gap-3" role="group" aria-label={s.label} data-testid={`checkin-${field}`}>
      <div className="min-w-0 flex-1">
        <div className="text-subhead font-medium text-foreground">{s.label}</div>
        <div className="truncate text-footnote text-muted-foreground">{value ? s.words[value - 1] : ' '}</div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {SCORE_VALUES.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={t.wellness.checkIn.scoreButton(s.label, n, s.words[n - 1]!)}
            onClick={() => onPick(n)}
            className={cn('size-10 rounded-full text-[15px] tabular-nums', choiceClass(value === n))}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function NigglePanel({ niggle, onChange }: { niggle: Partial<Niggle>; onChange: (next: Partial<Niggle>) => void }) {
  const c = t.wellness.checkIn
  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-[var(--fill-4)] p-3" data-testid="checkin-niggle">
      <div className="flex flex-col gap-2">
        <span className="text-footnote font-semibold text-muted-foreground">{c.where}</span>
        <div className="flex flex-wrap gap-1.5">
          {NIGGLE_SITES.map((site) => (
            <Chip key={site} selected={niggle.site === site} onClick={() => onChange({ ...niggle, site })}>
              {t.wellness.sites[site]}
            </Chip>
          ))}
        </div>
        <div className="flex gap-1.5">
          {NIGGLE_SIDES.map((side) => (
            <Chip key={side} selected={niggle.side === side} onClick={() => onChange({ ...niggle, side: niggle.side === side ? undefined : side })}>
              {t.wellness.sides[side]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2" role="group" aria-label={c.pain}>
        <span className="flex items-baseline justify-between gap-2 text-footnote">
          <span className="font-semibold text-muted-foreground">{c.pain}</span>
          <span className="text-muted-foreground">{c.painHint}</span>
        </span>
        <div className="flex gap-[3px]">
          {PAIN_VALUES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={niggle.pain === n}
              aria-label={c.painButton(n)}
              onClick={() => onChange({ ...niggle, pain: n })}
              className={cn('h-9 min-w-0 flex-1 rounded-[10px] text-[13px] tabular-nums', choiceClass(niggle.pain === n))}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Chip selected={niggle.changesRun === true} onClick={() => onChange({ ...niggle, changesRun: niggle.changesRun ? undefined : true })}>
          {c.changesRun}
        </Chip>
      </div>
    </div>
  )
}

function HideButton({ onHide }: { onHide: () => void }) {
  return (
    <button
      type="button"
      aria-label={t.wellness.checkIn.dismiss}
      onClick={onHide}
      data-testid="checkin-hide"
      className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X size={16} strokeWidth={2.2} aria-hidden />
    </button>
  )
}

function withoutUndefined(niggle: Partial<Niggle>): Partial<Niggle> {
  return Object.fromEntries(Object.entries(niggle).filter(([, value]) => value !== undefined)) as Partial<Niggle>
}

/** One tap per answer, each saved as it is made. */
export function CheckInForm({
  entry,
  onChange,
  onDone,
  onHide,
}: {
  entry: CheckIn
  onChange: (next: CheckIn) => void
  onDone: () => void
  onHide: () => void
}) {
  const c = t.wellness.checkIn
  // A niggle is stored once it has a site and a pain; until then the panel holds it here.
  const [pendingNiggle, setPendingNiggle] = useState<Partial<Niggle> | null>(null)
  const niggle = pendingNiggle ?? entry.niggle ?? null

  function pickScore(field: CheckInScore, value: number) {
    const next = { ...entry }
    if (entry[field] === value) delete next[field]
    else next[field] = value
    onChange(next)
  }

  function toggleFlag(flag: 'ill' | 'travel') {
    const next = { ...entry }
    if (entry[flag]) delete next[flag]
    else next[flag] = true
    onChange(next)
  }

  function toggleNiggle() {
    if (niggle) {
      setPendingNiggle(null)
      if (entry.niggle) {
        const next = { ...entry }
        delete next.niggle
        onChange(next)
      }
      return
    }
    setPendingNiggle({})
  }

  function changeNiggle(draft: Partial<Niggle>) {
    const clean = withoutUndefined(draft)
    if (clean.site !== undefined && clean.pain !== undefined) {
      setPendingNiggle(null)
      onChange({ ...entry, niggle: clean as Niggle })
    } else {
      setPendingNiggle(clean)
    }
  }

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="checkin-card" aria-label={c.eyebrow}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-eyebrow uppercase text-accent-text">{c.eyebrow}</span>
        <span className="flex items-center gap-1">
          <span className="text-footnote text-muted-foreground">{c.scaleHint}</span>
          <HideButton onHide={onHide} />
        </span>
      </div>

      {CHECK_IN_SCORES.map((field) => (
        <ScoreRow key={field} field={field} value={entry[field]} onPick={(value) => pickScore(field, value)} />
      ))}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Chip selected={niggle !== null} onClick={toggleNiggle} testId="checkin-flag-niggle">{c.flags.niggle}</Chip>
        <Chip selected={entry.ill === true} onClick={() => toggleFlag('ill')} testId="checkin-flag-ill">{c.flags.ill}</Chip>
        <Chip selected={entry.travel === true} onClick={() => toggleFlag('travel')} testId="checkin-flag-travel">{c.flags.travel}</Chip>
      </div>

      {niggle && <NigglePanel niggle={niggle} onChange={changeNiggle} />}

      {isCompleteCheckIn(entry) && (
        <Button variant="secondary" onClick={onDone} className="self-end" data-testid="checkin-done">
          {c.done}
        </Button>
      )}
    </section>
  )
}

export function CheckInSummary({ entry, onEdit, onHide }: { entry: CheckIn; onEdit: () => void; onHide: () => void }) {
  const c = t.wellness.checkIn
  return (
    <section className={cardClass({ padding: 'sm', className: 'flex items-center gap-3 pl-4' })} data-testid="checkin-summary" aria-label={c.eyebrow}>
      <Check size={16} strokeWidth={2.4} aria-hidden className="shrink-0 text-accent-text" />
      <p className="min-w-0 flex-1 text-footnote text-[var(--text-2)]">{checkInSummary(entry)}</p>
      <button type="button" onClick={onEdit} className="hit-44 shrink-0 text-[13px] font-semibold text-accent-text" data-testid="checkin-edit">
        {c.edit}
      </button>
      <HideButton onHide={onHide} />
    </section>
  )
}

/** Today's morning check-in: the owner's alone, read and written straight to Firestore under the owner-only rules. */
export function CheckInCard({ today }: { today: string }) {
  const { date, isOwner, day } = useTodayCheckIn(today)
  const mounted = useMounted()
  const [hiddenOn, setHiddenOn] = useState<string | null>(null)
  // Null until the athlete opens or closes it; a complete morning starts folded.
  const [open, setOpen] = useState<{ date: string; open: boolean } | null>(null)
  const { toast, leaving, showToast } = useToast()

  if (!mounted || !isOwner || day?.status !== 'ready') return <Toast toast={toast} leaving={leaving} />
  if (hiddenOn === date || hiddenFor(date)) return <Toast toast={toast} leaving={leaving} />

  const entry = day.entry
  const showForm = open?.date === date ? open.open : !isCompleteCheckIn(entry)

  function hide() {
    try {
      window.localStorage.setItem(hiddenKey(date), '1')
    } catch {}
    setHiddenOn(date)
  }

  function change(next: CheckIn) {
    setOpen({ date, open: true })
    saveCheckIn(date, isEmptyCheckIn(next) ? null : next).catch(() => showToast(t.settings.actions.error, false))
  }

  return (
    <>
      {showForm || !entry ? (
        <CheckInForm entry={entry ?? {}} onChange={change} onDone={() => setOpen({ date, open: false })} onHide={hide} />
      ) : (
        <CheckInSummary entry={entry} onEdit={() => setOpen({ date, open: true })} onHide={hide} />
      )}
      <Toast toast={toast} leaving={leaving} />
    </>
  )
}
