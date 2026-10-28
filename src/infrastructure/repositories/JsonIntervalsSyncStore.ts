import fs from 'fs'
import path from 'path'
import {
  emptyIntervalsSyncState,
  parseIntervalsSyncState,
  type IntervalsSyncState,
} from '@/application/coaching/intervalsSyncState'
import { dataPath } from '../dataPath'

export class JsonIntervalsSyncStore {
  private readonly filePath: string

  constructor(dataRoot = path.dirname(dataPath('coaching'))) {
    this.filePath = path.join(dataRoot, 'coaching', 'intervals-sync.json')
  }

  get location(): string {
    return this.filePath
  }

  read(): IntervalsSyncState {
    if (!fs.existsSync(this.filePath)) return emptyIntervalsSyncState()
    return parseIntervalsSyncState(JSON.parse(fs.readFileSync(this.filePath, 'utf-8')), this.filePath)
  }

  write(state: IntervalsSyncState): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`
    fs.writeFileSync(temporaryPath, `${JSON.stringify(parseIntervalsSyncState(state), null, 2)}\n`, 'utf-8')
    fs.renameSync(temporaryPath, this.filePath)
  }
}
