import fs from 'fs'
import { dataPath } from '../dataPath'
import type { PbYear } from '@/application/usecases/GetGoalsData'
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
  const filePath = dataPath('pbs.json')
  if (!fs.existsSync(filePath)) return []

  const raw = fs.readFileSync(filePath, 'utf-8')
  const years = (JSON.parse(raw) as { years: RawPbYear[] }).years

  return years.map((year) => ({
    year: year.year,
    entries: year.entries.map((entry) => ({
      distance: entry.distance,
      seconds: parseTimeInput(entry.time) ?? 0,
      activityId: entry.activityId,
    })),
  }))
}
