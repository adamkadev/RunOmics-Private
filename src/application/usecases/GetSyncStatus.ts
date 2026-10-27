import { dataPath } from '@/infrastructure/dataPath'
import { dataFs } from '@/infrastructure/dataFs'
import { DAY_MS } from '@/lib/calendarDate'
import { GARMIN_SERIES, seriesFreshness, type GarminSeries, type SeriesFreshness } from '@/domain/sync/seriesFreshness'

export interface SyncWarning {
  step: string
  message: string
}

export interface SyncMeta {
  lastSyncedAt: string | null
  /** From the last sync that read Garmin's series; a quick sync keeps the night's. */
  warnings: SyncWarning[]
  warningsAt: string | null
  seriesNewest: Partial<Record<GarminSeries, string | null>>
  /** When Garmin Connect last answered the gear list. */
  shoesCheckedAt: string | null
}

const EMPTY: SyncMeta = { lastSyncedAt: null, warnings: [], warningsAt: null, seriesNewest: {}, shoesCheckedAt: null }

const text = (value: unknown) => (typeof value === 'string' ? value : null)

function readWarnings(value: unknown): SyncWarning[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const { step, message } = (entry ?? {}) as Record<string, unknown>
    return typeof step === 'string' && typeof message === 'string' ? [{ step, message }] : []
  })
}

function readSeries(value: unknown): Partial<Record<GarminSeries, string | null>> {
  if (typeof value !== 'object' || value === null) return {}
  const raw = value as Record<string, unknown>
  return Object.fromEntries(GARMIN_SERIES.filter((series) => series in raw).map((series) => [series, text(raw[series])]))
}

export function getSyncMeta(): SyncMeta {
  const filePath = dataPath('sync_meta.json')
  if (!dataFs.existsSync(filePath)) return EMPTY
  const raw = JSON.parse(dataFs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>
  return {
    lastSyncedAt: text(raw.lastSyncedAt),
    warnings: readWarnings(raw.warnings),
    warningsAt: text(raw.warningsAt),
    seriesNewest: readSeries(raw.seriesFreshness),
    shoesCheckedAt: text(raw.shoesCheckedAt),
  }
}

export function getLastSyncedAt(): string | null {
  return getSyncMeta().lastSyncedAt
}

export interface GarminSeriesStatus {
  series: SeriesFreshness[]
  warningSteps: string[]
  warningCount: number
}

export function getGarminSeriesStatus(now = Date.now()): GarminSeriesStatus {
  const meta = getSyncMeta()
  return {
    series: seriesFreshness(meta.seriesNewest, now),
    warningSteps: [...new Set(meta.warnings.map((warning) => warning.step))],
    warningCount: meta.warnings.length,
  }
}

/** Past this, a pair added or retired in Garmin since may be missing: the list comes only through Connect. */
const SHOE_LIST_OLD_DAYS = 14

/** The date Connect last answered the gear list, once that is old enough to say; null while it is current or unknown. */
export function getOldShoeListDate(now = Date.now()): string | null {
  const { shoesCheckedAt } = getSyncMeta()
  if (!shoesCheckedAt || now - Date.parse(shoesCheckedAt) <= SHOE_LIST_OLD_DAYS * DAY_MS) return null
  return shoesCheckedAt.slice(0, 10)
}
