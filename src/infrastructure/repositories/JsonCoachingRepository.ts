import fs from 'fs'
import path from 'path'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { CoachDecision, CoachState, CoachingPlan, WorkoutEvaluation } from '@/domain/coaching/types'
import {
  parseCoachDecision,
  parseCoachState,
  parseCoachingPlan,
  parseWorkoutEvaluation,
} from '@/domain/coaching/validation'
import { dataPath } from '../dataPath'
import { dataFs } from '../dataFs'

interface HistoryIndex {
  keys: string[]
}

function readJson(filePath: string): unknown {
  return JSON.parse(dataFs.readFileSync(filePath, 'utf-8')) as unknown
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  fs.renameSync(temporaryPath, filePath)
}

function historyKey(date: string, precision: 'year' | 'month'): string {
  return precision === 'year' ? date.slice(0, 4) : date.slice(0, 7)
}

function readIndex(dir: string): string[] {
  const filePath = path.join(dir, 'index.json')
  if (!dataFs.existsSync(filePath)) return []
  const raw = readJson(filePath) as Partial<HistoryIndex>
  return Array.isArray(raw.keys) ? raw.keys.filter((key): key is string => typeof key === 'string') : []
}

function writeIndex(dir: string, keys: string[]): void {
  writeJsonAtomic(path.join(dir, 'index.json'), { keys: [...new Set(keys)].sort().reverse() })
}

export class JsonCoachingRepository implements CoachingRepository {
  private readonly coachingDir: string

  constructor(dataRoot = path.dirname(dataPath('coaching'))) {
    this.coachingDir = path.join(dataRoot, 'coaching')
  }

  getCurrentPlan(): CoachingPlan | null {
    const filePath = path.join(this.coachingDir, 'current_plan.json')
    return dataFs.existsSync(filePath) ? parseCoachingPlan(readJson(filePath), filePath) : null
  }

  saveCurrentPlan(plan: CoachingPlan): void {
    writeJsonAtomic(path.join(this.coachingDir, 'current_plan.json'), parseCoachingPlan(plan))
  }

  /** Superseded plans keep their own file so a regeneration is reversible. */
  archivePlan(plan: CoachingPlan): void {
    const dir = path.join(this.coachingDir, 'superseded')
    fs.mkdirSync(dir, { recursive: true })
    writeJsonAtomic(path.join(dir, `${plan.id}.json`), parseCoachingPlan({ ...plan, status: 'superseded' }))
  }

  /** The plans archivePlan kept, newest first: the only record of a finished block's sessions. */
  getArchivedPlans(): CoachingPlan[] {
    const dir = path.join(this.coachingDir, 'superseded')
    if (!dataFs.existsSync(dir)) return []
    return dataFs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => parseCoachingPlan(readJson(path.join(dir, file)), path.join(dir, file)))
      .sort((a, b) => b.provenance.createdAt.localeCompare(a.provenance.createdAt))
  }

  getState(): CoachState | null {
    const filePath = path.join(this.coachingDir, 'coach_state.json')
    return dataFs.existsSync(filePath) ? parseCoachState(readJson(filePath), filePath) : null
  }

  saveState(state: CoachState): void {
    writeJsonAtomic(path.join(this.coachingDir, 'coach_state.json'), parseCoachState(state))
  }

  getDecisions(): CoachDecision[] {
    return this.readHistory('decisions', 'decisions', parseCoachDecision)
  }

  getDecision(id: string): CoachDecision | null {
    return this.getDecisions().find((decision) => decision.id === id) ?? null
  }

  saveDecision(decision: CoachDecision): void {
    this.saveHistory('decisions', 'decisions', parseCoachDecision(decision), 'year')
  }

  getEvaluations(): WorkoutEvaluation[] {
    return this.readHistory('evaluations', 'evaluations', parseWorkoutEvaluation)
  }

  getEvaluationForActivity(activityId: string): WorkoutEvaluation | null {
    return this.getEvaluations().find((evaluation) => evaluation.activityId === activityId) ?? null
  }

  saveEvaluation(evaluation: WorkoutEvaluation): void {
    this.saveHistory('evaluations', 'evaluations', parseWorkoutEvaluation(evaluation), 'month')
  }

  private readHistory<T>(
    directory: string,
    field: string,
    parser: (value: unknown, path?: string) => T,
  ): T[] {
    const dir = path.join(this.coachingDir, directory)
    if (!dataFs.existsSync(dir)) return []
    const keys = readIndex(dir)
    const files = keys.length
      ? keys.map((key) => `${key}.json`)
      : dataFs.readdirSync(dir).filter((file) => file.endsWith('.json') && file !== 'index.json')

    return files
      .flatMap((file) => {
        const filePath = path.join(dir, file)
        if (!dataFs.existsSync(filePath)) return []
        const raw = readJson(filePath) as Record<string, unknown>
        const entries = raw[field]
        if (!Array.isArray(entries)) throw new Error(`${filePath}: ${field} must be an array`)
        return entries.map((entry, index) => parser(entry, `${filePath}.${field}[${index}]`))
      })
      .sort((left, right) => {
        const a = (left as { createdAt?: string }).createdAt ?? ''
        const b = (right as { createdAt?: string }).createdAt ?? ''
        return b.localeCompare(a)
      })
  }

  private saveHistory<T extends { id: string; createdAt: string }>(
    directory: string,
    field: string,
    entry: T,
    precision: 'year' | 'month',
  ): void {
    const dir = path.join(this.coachingDir, directory)
    const key = historyKey(entry.createdAt, precision)
    const filePath = path.join(dir, `${key}.json`)
    const raw = dataFs.existsSync(filePath) ? (readJson(filePath) as Record<string, unknown>) : {}
    const current = Array.isArray(raw[field]) ? (raw[field] as T[]) : []
    const entries = [...current.filter((candidate) => candidate.id !== entry.id), entry]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    writeJsonAtomic(filePath, { [field]: entries })
    writeIndex(dir, [...readIndex(dir), key])
  }
}
