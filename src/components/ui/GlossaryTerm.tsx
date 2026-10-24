'use client'

import { useId, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { FORM_BAND_THRESHOLDS } from '@/domain/training/formBand'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export type GlossaryKey = Exclude<keyof typeof t.glossary, 'about'>

export function glossaryDefinition(term: GlossaryKey): string {
  const entry = t.glossary[term]
  if (term === 'form') {
    const { tiredBelow, freshAbove, veryFreshAbove } = FORM_BAND_THRESHOLDS
    return t.glossary.form.definition(tiredBelow, freshAbove, veryFreshAbove)
  }
  return (entry as { definition: string }).definition
}

export function InfoButton({
  open,
  onToggle,
  label,
  controls,
  className,
}: {
  open: boolean
  onToggle: () => void
  label: string
  controls?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      aria-label={label}
      className={cn(
        'hit-44 inline-flex shrink-0 rounded-full p-0.5 align-middle normal-case tracking-normal transition-colors active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        open ? 'text-foreground' : 'text-subtle hover:text-muted-foreground',
        className,
      )}
    >
      <Info size={14} aria-hidden="true" />
    </button>
  )
}

export function GlossaryTerm({
  term,
  children,
  className,
  quiet = false,
}: {
  term: GlossaryKey
  children?: ReactNode
  className?: string
  /** No (i): the label itself opens the definition on a tap. */
  quiet?: boolean
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const name = t.glossary[term].term

  if (quiet) {
    return (
      <span className={cn('inline', className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-label={t.glossary.about(name)}
          className="hit-44 inline text-left [text-transform:inherit]"
        >
          {children ?? name}
        </button>
        {open && (
          <span id={id} role="note" className="mt-1 block text-xs font-normal normal-case leading-snug tracking-normal text-subtle">
            {glossaryDefinition(term)}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className={cn('inline', className)}>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {children ?? name}
        <InfoButton open={open} onToggle={() => setOpen((v) => !v)} label={t.glossary.about(name)} controls={id} className="-my-0.5" />
      </span>
      {open && (
        <span id={id} role="note" className="mt-1 block text-xs font-normal normal-case leading-snug tracking-normal text-subtle">
          {glossaryDefinition(term)}
        </span>
      )}
    </span>
  )
}
