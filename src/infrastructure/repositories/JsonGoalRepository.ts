import fs from 'fs'
import path from 'path'
import type { GoalYear } from '@/application/usecases/GetGoalsData'
import { parseTimeInput } from '@/lib/formatters'

interface RawGoalTarget {
  distance: string
  target: string | null
}

interface RawGoalYear {
  year: number
  annualDistanceKm: number
  targets: RawGoalTarget[]
}

export function getGoalYears(): GoalYear[] {
  const filePath = path.join(process.cwd(), 'public', 'data', 'goals.json')
  if (!fs.existsSync(filePath)) return []

  const raw = fs.readFileSync(filePath, 'utf-8')
  const years = (JSON.parse(raw) as { years: RawGoalYear[] }).years

  return years.map((year) => ({
    year: year.year,
    annualDistanceKm: year.annualDistanceKm,
    targets: year.targets.map((target) => ({
      distance: target.distance,
      targetSeconds: target.target ? parseTimeInput(target.target) : null,
    })),
  }))
}
