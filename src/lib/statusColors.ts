// No tinted fills: a status is its text or dot colour on a neutral chip.
const CHIP = 'bg-[var(--segmented-track)]'

export const STATUS = {
  success: {
    text:  'text-delta-good',
    bg:    CHIP,
    dot:   'bg-delta-good',
    badge: `${CHIP} text-delta-good`,
  },
  progress: {
    text:  'text-[var(--metric-fitness)]',
    bg:    CHIP,
    dot:   'bg-[var(--metric-fitness)]',
    badge: `${CHIP} text-[var(--metric-fitness)]`,
  },
  pending: {
    text:  'text-muted-foreground',
    bg:    CHIP,
    dot:   'bg-subtle',
    badge: `${CHIP} text-muted-foreground`,
  },
  warning: {
    text:  'text-[var(--tone-caution)]',
    bg:    CHIP,
    dot:   'bg-[var(--tone-caution)]',
    badge: `${CHIP} text-[var(--tone-caution)]`,
  },
  danger: {
    text:  'text-destructive',
    bg:    CHIP,
    dot:   'bg-destructive',
    badge: `${CHIP} text-destructive`,
  },
  gold:   { text: 'text-[#f5b13d]', dot: 'bg-[#f5b13d]' },
  silver: { text: 'text-[#c3ccd6]', dot: 'bg-[#c3ccd6]' },
  bronze: { text: 'text-[#b06a3b]', dot: 'bg-[#b06a3b]' },
} as const

export const PROJECTION_TONE: Record<'ahead' | 'on_track' | 'behind', string> = {
  ahead:    STATUS.success.text,
  on_track: STATUS.progress.text,
  behind:   STATUS.warning.text,
}
