import type { AccentId } from '@/lib/accent'

export const ACCENT_TOKENS: Record<AccentId, {
  accentHex: string
}> = {
  nature:      { accentHex: '#10b981' },
  performance: { accentHex: '#3b82f6' },
  impact:      { accentHex: '#f43f5e' },
  motivation:  { accentHex: '#f97316' },
  endurance:   { accentHex: '#8b5cf6' },
  silver:      { accentHex: '#94a3b8' },
}
