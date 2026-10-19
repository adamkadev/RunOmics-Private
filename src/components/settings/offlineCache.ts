import { formatNumber } from '@/lib/formatters'
import { t } from '@/i18n'

interface Estimate {
  usage?: number
  /** Chromium only: the usage split by store, the Cache API's among them. */
  usageDetails?: { caches?: number }
}

/**
 * What the offline cache holds, in bytes, or null where the browser will not
 * say. The Cache API's own share where the estimate splits it out; the
 * origin's whole usage otherwise, which is mostly that cache.
 */
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

/** "24 MB", "1.2 MB", "380 KB"; nothing for an empty cache, which has no size worth showing. */
export function formatCacheSize(bytes: number | null): string | null {
  if (bytes === null || bytes < KB) return null
  if (bytes < MB) return `${formatNumber(Math.round(bytes / KB), 0)} ${t.units.kb}`
  const mb = bytes / MB
  return `${formatNumber(mb, mb < 10 ? 1 : 0)} ${t.units.mb}`
}
