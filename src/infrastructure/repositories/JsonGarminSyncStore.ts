import fs from 'fs'
import path from 'path'
import {
  emptyGarminSyncState,
  parseGarminSyncState,
  type GarminSyncState,
} from '@/application/coaching/garminSyncState'
import { dataPath } from '../dataPath'

export class JsonGarminSyncStore {
  private readonly filePath: string

  constructor(dataRoot = path.dirname(dataPath('coaching'))) {
    this.filePath = path.join(dataRoot, 'coaching', 'garmin-sync.json')
  }

  get location(): string {
    return this.filePath
  }

  read(): GarminSyncState {
    if (!fs.existsSync(this.filePath)) return emptyGarminSyncState()
    return parseGarminSyncState(JSON.parse(fs.readFileSync(this.filePath, 'utf-8')), this.filePath)
  }

  write(state: GarminSyncState): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`
    fs.writeFileSync(temporaryPath, `${JSON.stringify(parseGarminSyncState(state), null, 2)}\n`, 'utf-8')
    fs.renameSync(temporaryPath, this.filePath)
  }
}
