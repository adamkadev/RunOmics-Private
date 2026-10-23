import { formatNumber } from '@/lib/formatters'
import { t } from '@/i18n'

interface Estimate {
  usage?: number
  /** Chromium only. */
  usageDetails?: { caches?: number }
}

/** Falls back to the origin's whole usage, which is mostly the offline cache. */
export async function offlineCacheBytes(storage: { estimate?: () => Promise<Estimate> } | undefined = globalThis.navigator?.storage): Promise<number | null> {
  try {
    const estimate = await storage?.estimate?.()
    if (!estimate) return null
    return estimate.usageDetails?.caches ?? estimate.usage ?? null
  } catch {
    return null
  }
}

const KB = 1024
const MB = KB * 1024

export function formatCacheSize(bytes: number | null): string | null {
  if (bytes === null || bytes < KB) return null
  if (bytes < MB) return `${formatNumber(Math.round(bytes / KB), 0)} ${t.units.kb}`
  const mb = bytes / MB
  return `${formatNumber(mb, mb < 10 ? 1 : 0)} ${t.units.mb}`
}
