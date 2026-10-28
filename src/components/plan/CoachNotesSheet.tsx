'use client'

import type { ReactNode } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { t } from '@/i18n'
import type { CoachNotes } from './coachNotes'

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 border-t border-border py-3 first:border-t-0 first:pt-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-text">{label}</h3>
      {children}
    </section>
  )
}

// Loaded when the sheet first opens.
export function CoachNotesSheet({ notes, subtitle, onClose }: { notes: CoachNotes; subtitle: string; onClose: () => void }) {
  const c = t.plan.coachNotes
  return (
    <Sheet onClose={onClose} title={c.title} titleId="coach-notes-title" testId="coach-notes-sheet">
      <div className="flex flex-col pb-2 pt-1">
        <p className="pb-2 text-[13px] text-muted-foreground">{subtitle}</p>
        {notes.session.length > 0 && (
          <Section label={c.session}>
            {notes.session.map((line) => <p key={line} className="text-[15px] text-foreground">{line}</p>)}
          </Section>
        )}
        {notes.steps.length > 0 && (
          <Section label={c.steps}>
            {notes.steps.map((step, i) => (
              <div key={i} className="flex flex-col gap-0.5 py-1" data-testid="coach-notes-step">
                <span className="text-sm font-semibold text-foreground">{step.label}</span>
                {step.notes.map((note) => <p key={note} className="text-sm text-[var(--text-2)]">{note}</p>)}
              </div>
            ))}
          </Section>
        )}
        {notes.week && (
          <Section label={c.week}>
            <p className="text-[15px] text-foreground">{notes.week}</p>
          </Section>
        )}
      </div>
    </Sheet>
  )
}
