import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { PbYear } from '@/domain/goals/types'
import { parseTimeInput } from '@/lib/formatters'

interface RawPbEntry {
  distance: string
  time: string
  activityId: string
}

interface RawPbYear {
  year: number
  entries: RawPbEntry[]
}

export function getPbYears(): PbYear[] {
  const { years } = readJsonFile<{ years?: RawPbYear[] }>(dataPath('pbs.json'), {})

  return (years ?? []).map((year) => ({
    year: year.year,
    entries: year.entries.map((entry) => ({
      distance: entry.distance,
      seconds: parseTimeInput(entry.time) ?? 0,
      activityId: entry.activityId,
    })),
  }))
}
