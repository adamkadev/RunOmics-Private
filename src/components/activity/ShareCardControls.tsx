'use client'

/** Small presentational pieces shared by the share-card modal's settings rows. */

import { SHARE_CARD_COLORS } from '@/lib/colors'

interface ToggleProps {
  on: boolean
  onChange: (v: boolean) => void
  accentHex: string
  disabled?: boolean
}

export function Toggle({ on, onChange, accentHex, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative ml-4 h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40"
      style={{ background: on ? accentHex : SHARE_CARD_COLORS.toggleOff }}
    >
      <span
        className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[var(--shadow-toggle)] transition-[left] duration-200"
        style={{ left: on ? 22 : 2 }}
      />
    </button>
  )
}

export function RowDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
}

interface SettingRowProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

/** Label (+ optional subtitle) on the left, control on the right. */
export function SettingRow({ title, subtitle, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '11px 16px' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ro-text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: 'var(--ro-text-3)' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}
